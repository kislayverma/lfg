/**
 * Pattern Detection Service.
 *
 * Analyzes activity_logs to detect recurring patterns in when
 * a user performs activities. Three pattern types are detected:
 *
 *   1. Day-of-week frequency — which weekdays the user typically logs
 *   2. Time-of-day clustering — around what hour/minute the user logs
 *   3. Interval regularity   — every N days between consecutive logs
 *
 * Results are stored in the detected_patterns table for use by the
 * nudge scheduler.
 */

import {database, Activity, ActivityLog, DetectedPattern} from '../database';
import {Q} from '@nozbe/watermelondb';
import {useAuthStore} from '../stores/authStore';

// ── Configuration ────────────────────────────────────────────────────

/** Minimum logs needed before we attempt pattern detection */
const MIN_LOGS = 5;

/** Patterns below this confidence are discarded */
const MIN_CONFIDENCE = 0.45;

/** Only look at logs from the last N days for freshness */
const LOOKBACK_DAYS = 90;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Runs pattern detection for all activities belonging to the current user.
 * Replaces all existing detected_patterns rows for the user.
 */
export async function detectAllPatterns(): Promise<void> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    return;
  }

  const activities = await database
    .get<Activity>('activities')
    .query(Q.where('user_id', userId))
    .fetch();

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  for (const activity of activities) {
    const logs = await database
      .get<ActivityLog>('activity_logs')
      .query(
        Q.where('activity_id', activity.id),
        Q.where('log_date', Q.gte(cutoff)),
        Q.sortBy('log_date', 'asc'),
      )
      .fetch();

    if (logs.length < MIN_LOGS) {
      // Not enough data — remove any stale patterns
      await clearPatternsForActivity(userId, activity.id);
      continue;
    }

    const patterns: PatternCandidate[] = [];

    // Detect day-of-week pattern
    const dow = detectDayOfWeekPattern(logs);
    if (dow && dow.confidence >= MIN_CONFIDENCE) {
      patterns.push(dow);
    }

    // Detect time-of-day pattern
    const tod = detectTimeOfDayPattern(logs);
    if (tod && tod.confidence >= MIN_CONFIDENCE) {
      patterns.push(tod);
    }

    // Detect interval pattern
    const interval = detectIntervalPattern(logs);
    if (interval && interval.confidence >= MIN_CONFIDENCE) {
      patterns.push(interval);
    }

    // Persist detected patterns
    await persistPatterns(userId, activity.id, patterns, logs.length);
  }
}

// ── Pattern detection algorithms ─────────────────────────────────────

interface PatternCandidate {
  patternType: 'day_of_week' | 'time_of_day' | 'interval';
  patternData: string; // JSON
  confidence: number;
}

/**
 * Day-of-week frequency analysis.
 *
 * Counts how many logs fall on each weekday. If certain days have
 * significantly higher frequency than the average, those days form
 * the pattern.
 *
 * Confidence = proportion of logs on the detected days.
 */
function detectDayOfWeekPattern(
  logs: ActivityLog[],
): PatternCandidate | null {
  const dayCounts = new Array(7).fill(0); // 0=Sun, 6=Sat
  for (const log of logs) {
    const day = new Date(log.logDate).getDay();
    dayCounts[day]++;
  }

  const total = logs.length;
  const avgPerDay = total / 7;

  // Days with >= 1.5x average frequency are considered "pattern days"
  const patternDays: number[] = [];
  for (let d = 0; d < 7; d++) {
    if (dayCounts[d] >= avgPerDay * 1.5 && dayCounts[d] >= 2) {
      patternDays.push(d);
    }
  }

  if (patternDays.length === 0 || patternDays.length >= 7) {
    return null; // No pattern or every day (effectively no pattern)
  }

  // Confidence = how many logs fall on pattern days / total
  const patternLogs = patternDays.reduce((sum, d) => sum + dayCounts[d], 0);
  const confidence = patternLogs / total;

  return {
    patternType: 'day_of_week',
    patternData: JSON.stringify({days: patternDays}),
    confidence,
  };
}

/**
 * Time-of-day clustering.
 *
 * Uses the created_at timestamp (not logDate which is midnight-normalized)
 * to find the typical time the user logs the activity.
 *
 * Computes circular mean of the log times (treating hours as angles on
 * a 24-hour clock) and measures the spread (concentration parameter).
 * Tight clustering = high confidence.
 */
function detectTimeOfDayPattern(
  logs: ActivityLog[],
): PatternCandidate | null {
  // Use createdAt (actual timestamp) rather than logDate (midnight)
  const minutesOfDay: number[] = [];
  for (const log of logs) {
    // createdAt is a Date object from the @date decorator
    const d = log.createdAt;
    if (d) {
      minutesOfDay.push(d.getHours() * 60 + d.getMinutes());
    }
  }

  if (minutesOfDay.length < MIN_LOGS) {
    return null;
  }

  // Circular mean (treating 24h as a circle of 1440 minutes)
  const TWO_PI = 2 * Math.PI;
  let sinSum = 0;
  let cosSum = 0;
  for (const m of minutesOfDay) {
    const angle = (m / 1440) * TWO_PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  sinSum /= minutesOfDay.length;
  cosSum /= minutesOfDay.length;

  // Mean angle -> mean minute
  let meanAngle = Math.atan2(sinSum, cosSum);
  if (meanAngle < 0) {
    meanAngle += TWO_PI;
  }
  const meanMinute = (meanAngle / TWO_PI) * 1440;
  const hour = Math.floor(meanMinute / 60);
  const minute = Math.round(meanMinute % 60);

  // Concentration R (0 = uniform, 1 = perfectly concentrated)
  const R = Math.sqrt(sinSum * sinSum + cosSum * cosSum);

  // Only meaningful if R > 0.5 (reasonably clustered)
  if (R < 0.4) {
    return null;
  }

  return {
    patternType: 'time_of_day',
    patternData: JSON.stringify({hour, minute}),
    confidence: R,
  };
}

/**
 * Interval regularity detection.
 *
 * Computes the gaps (in days) between consecutive log dates.
 * If the standard deviation of gaps is low relative to the mean,
 * there's a regular interval.
 *
 * Confidence = 1 - (stddev / mean), clamped to [0, 1].
 */
function detectIntervalPattern(
  logs: ActivityLog[],
): PatternCandidate | null {
  if (logs.length < 3) {
    return null; // Need at least 3 logs for 2 intervals
  }

  // Deduplicate by date (same logDate = same day)
  const uniqueDates: number[] = [];
  let lastDate = -1;
  for (const log of logs) {
    if (log.logDate !== lastDate) {
      uniqueDates.push(log.logDate);
      lastDate = log.logDate;
    }
  }

  if (uniqueDates.length < 3) {
    return null;
  }

  const gaps: number[] = [];
  for (let i = 1; i < uniqueDates.length; i++) {
    const gapMs = uniqueDates[i] - uniqueDates[i - 1];
    const gapDays = Math.round(gapMs / (24 * 60 * 60 * 1000));
    if (gapDays > 0) {
      gaps.push(gapDays);
    }
  }

  if (gaps.length < 2) {
    return null;
  }

  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance =
    gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
  const stddev = Math.sqrt(variance);

  // Skip if mean interval is less than 1 day (daily habit — use day_of_week instead)
  if (mean < 1.5) {
    return null;
  }

  // Coefficient of variation — lower = more regular
  const cv = stddev / mean;
  const confidence = Math.max(0, Math.min(1, 1 - cv));

  if (confidence < MIN_CONFIDENCE) {
    return null;
  }

  return {
    patternType: 'interval',
    patternData: JSON.stringify({days: Math.round(mean)}),
    confidence,
  };
}

// ── Persistence helpers ──────────────────────────────────────────────

async function clearPatternsForActivity(
  userId: string,
  activityId: string,
): Promise<void> {
  const existing = await database
    .get<DetectedPattern>('detected_patterns')
    .query(
      Q.where('user_id', userId),
      Q.where('activity_id', activityId),
    )
    .fetch();

  if (existing.length > 0) {
    await database.write(async () => {
      await database.batch(
        ...existing.map(p => p.prepareDestroyPermanently()),
      );
    });
  }
}

async function persistPatterns(
  userId: string,
  activityId: string,
  candidates: PatternCandidate[],
  sampleSize: number,
): Promise<void> {
  const collection = database.get<DetectedPattern>('detected_patterns');
  const now = Date.now();

  // Fetch existing patterns to delete
  const existing = await collection
    .query(
      Q.where('user_id', userId),
      Q.where('activity_id', activityId),
    )
    .fetch();

  await database.write(async () => {
    await database.batch(
      // Remove old patterns
      ...existing.map(p => p.prepareDestroyPermanently()),
      // Create new patterns
      ...candidates.map(c =>
        collection.prepareCreate(record => {
          record.userId = userId;
          record.activityId = activityId;
          record.patternType = c.patternType;
          record.patternData = c.patternData;
          record.confidence = c.confidence;
          record.sampleSize = sampleSize;
          record.lastCalculatedAt = now;
        }),
      ),
    );
  });
}
