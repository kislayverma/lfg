/**
 * Nudge Scheduler Service.
 *
 * Uses detected patterns to schedule smart nudge notifications
 * for activities the user hasn't logged yet. Implements anti-annoyance
 * rules to avoid notification fatigue:
 *
 *   - Frequency cap: max 3 nudges per day across all activities
 *   - Quiet hours: no nudges between 10pm and 7am
 *   - Backoff: exponential backoff per activity (3d → 7d → 14d → 30d → stop)
 *   - Already-done check: skip nudge if user already logged today
 *   - Timing jitter: ±15 min random offset to feel natural
 */

import notifee, {
  TriggerType,
  AndroidImportance,
  type TimestampTrigger,
} from '@notifee/react-native';
import {Platform} from 'react-native';
import {
  database,
  Activity,
  ActivityLog,
  DetectedPattern,
  NudgeHistory,
} from '../database';
import {Q} from '@nozbe/watermelondb';
import {useAuthStore} from '../stores/authStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {setupNotificationChannels, CHANNEL_REMINDERS} from './notifications';
import {toMidnightTimestamp} from '../utils/date';

// ── Channel ──────────────────────────────────────────────────────────

export const CHANNEL_NUDGES = 'smart-nudges';

export async function setupNudgeChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_NUDGES,
      name: 'Smart Nudges',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

// ── Configuration ────────────────────────────────────────────────────

/** Maximum nudges sent per day across all activities */
const MAX_NUDGES_PER_DAY = 3;

/** Quiet hours — no nudges between these local hours */
const QUIET_START_HOUR = 22; // 10pm
const QUIET_END_HOUR = 7; // 7am

/** Backoff stages (consecutive ignored nudges → cooldown days) */
const BACKOFF_STAGES = [3, 7, 14, 30]; // days

/** Minimum confidence threshold for patterns to generate nudges */
const CONFIDENCE_THRESHOLD = 0.65;

/** Random jitter applied to nudge time (in minutes) */
const JITTER_MINUTES = 15;

// ── Message templates ────────────────────────────────────────────────

const NUDGE_TITLES = [
  'Time for {activity}?',
  'Ready for {activity}?',
  'How about {activity}?',
  '{activity} time!',
];

const NUDGE_BODIES = [
  "You usually do this around now. Let's keep it going!",
  "Based on your routine, now's a great time.",
  'Your past self would be proud. Keep the streak alive!',
  "Just a gentle reminder — you've got this!",
  'Consistency is key. Ready to check this off?',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Evaluates all detected patterns and schedules nudge notifications
 * for activities that the user is expected to do but hasn't yet.
 *
 * Called from the plugin's onBackgroundTask or onForeground handler.
 */
export async function evaluateAndScheduleNudges(): Promise<void> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    return;
  }

  // Check global notification + smart nudge preferences
  const prefs = usePreferencesStore.getState();
  if (!prefs.notificationsEnabled || !prefs.smartNudgesEnabled) {
    return;
  }

  // Check notification permission
  const settings = await notifee.getNotificationSettings();
  if (settings.authorizationStatus < 1) {
    return;
  }

  await setupNudgeChannel();

  const today = toMidnightTimestamp(new Date());
  const now = Date.now();

  // How many nudges already sent today?
  const todayNudges = await database
    .get<NudgeHistory>('nudge_history')
    .query(
      Q.where('user_id', userId),
      Q.where('nudge_sent_at', Q.gte(today)),
      Q.where('outcome', Q.notEq('suppressed')),
    )
    .fetchCount();

  if (todayNudges >= MAX_NUDGES_PER_DAY) {
    return;
  }

  let nudgesScheduled = todayNudges;

  // Get all patterns above confidence threshold
  const patterns = await database
    .get<DetectedPattern>('detected_patterns')
    .query(
      Q.where('user_id', userId),
      Q.where('confidence', Q.gte(CONFIDENCE_THRESHOLD)),
    )
    .fetch();

  // Group patterns by activity
  const activityPatterns = new Map<string, DetectedPattern[]>();
  for (const p of patterns) {
    const existing = activityPatterns.get(p.activityId) || [];
    existing.push(p);
    activityPatterns.set(p.activityId, existing);
  }

  for (const [activityId, pats] of activityPatterns) {
    if (nudgesScheduled >= MAX_NUDGES_PER_DAY) {
      break;
    }

    // Check if activity was already logged today
    const todayLogs = await database
      .get<ActivityLog>('activity_logs')
      .query(
        Q.where('activity_id', activityId),
        Q.where('log_date', today),
      )
      .fetchCount();

    if (todayLogs > 0) {
      continue; // Already done today
    }

    // Check if today is a "pattern day" for this activity
    if (!shouldNudgeToday(pats)) {
      continue;
    }

    // Check backoff
    const backoffOk = await checkBackoff(userId, activityId);
    if (!backoffOk) {
      continue;
    }

    // Determine nudge time
    const nudgeTime = determineNudgeTime(pats, now);
    if (!nudgeTime) {
      continue; // No valid time (e.g. quiet hours, already past)
    }

    // Fetch activity name for the notification
    let activityName: string;
    try {
      const activity = await database
        .get<Activity>('activities')
        .find(activityId);
      activityName = activity.name;
    } catch {
      continue; // Activity may have been deleted
    }

    // Schedule the notification
    const notificationId = `nudge-${activityId}-${today}`;

    // Cancel any existing nudge for this activity today
    try {
      await notifee.cancelTriggerNotification(notificationId);
    } catch {
      // May not exist
    }

    const title = pickRandom(NUDGE_TITLES).replace('{activity}', activityName);
    const body = pickRandom(NUDGE_BODIES);

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: nudgeTime,
    };

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title,
        body,
        data: {
          type: 'smart-nudge',
          activityId,
          nudgeDate: today,
        },
        android: {
          channelId: CHANNEL_NUDGES,
          pressAction: {id: 'default'},
          actions: [
            {
              title: 'Log it now',
              pressAction: {id: 'nudge-log'},
            },
            {
              title: 'Snooze 1hr',
              pressAction: {id: 'nudge-snooze'},
            },
          ],
          smallIcon: 'ic_notification',
          importance: AndroidImportance.DEFAULT,
        },
        ios: {
          categoryId: 'smart-nudge',
          sound: 'default',
        },
      },
      trigger,
    );

    // Record in nudge history
    await database.write(async () => {
      await database.get<NudgeHistory>('nudge_history').create(record => {
        record.userId = userId;
        record.activityId = activityId;
        record.nudgeSentAt = nudgeTime;
        record.outcome = 'sent';
        record.notificationId = notificationId;
      });
    });

    nudgesScheduled++;
  }
}

/**
 * Cancels all pending nudge notifications.
 * Called when smart nudges are disabled.
 */
export async function cancelAllNudges(): Promise<void> {
  const triggerIds = await notifee.getTriggerNotificationIds();
  const nudgeIds = triggerIds.filter(id => id.startsWith('nudge-'));
  for (const id of nudgeIds) {
    await notifee.cancelTriggerNotification(id);
  }
}

// ── iOS category setup ───────────────────────────────────────────────

/**
 * Sets up iOS notification categories for smart nudges.
 */
export async function setupNudgeIOSCategories(): Promise<void> {
  if (Platform.OS === 'ios') {
    // We need to call setNotificationCategories with ALL categories
    // (including existing ones). We'll add the nudge category.
    await notifee.setNotificationCategories([
      {
        id: 'habit-reminder',
        actions: [
          {
            id: 'mark-done',
            title: 'Mark Done',
            foreground: false,
          },
        ],
      },
      {
        id: 'smart-nudge',
        actions: [
          {
            id: 'nudge-log',
            title: 'Log it now',
            foreground: false,
          },
          {
            id: 'nudge-snooze',
            title: 'Snooze 1hr',
            foreground: false,
          },
        ],
      },
    ]);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Checks if today matches any day_of_week or interval pattern.
 */
function shouldNudgeToday(patterns: DetectedPattern[]): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun

  for (const p of patterns) {
    if (p.patternType === 'day_of_week') {
      const data = JSON.parse(p.patternData) as {days: number[]};
      if (data.days.includes(dayOfWeek)) {
        return true;
      }
    }

    if (p.patternType === 'interval') {
      // For interval patterns, we always consider nudging
      // (the backoff logic will handle frequency)
      return true;
    }
  }

  return false;
}

/**
 * Determines the nudge time based on time_of_day patterns.
 * Falls back to a default time if no time pattern exists.
 * Respects quiet hours and adds jitter.
 *
 * Returns null if no valid time can be determined (e.g. already past).
 */
function determineNudgeTime(
  patterns: DetectedPattern[],
  now: number,
): number | null {
  let targetHour = 9; // default fallback: 9am
  let targetMinute = 0;

  // Look for a time_of_day pattern
  for (const p of patterns) {
    if (p.patternType === 'time_of_day') {
      const data = JSON.parse(p.patternData) as {hour: number; minute: number};
      targetHour = data.hour;
      targetMinute = data.minute;
      break;
    }
  }

  // Apply jitter (±JITTER_MINUTES)
  const jitter = Math.floor(Math.random() * JITTER_MINUTES * 2) - JITTER_MINUTES;
  let totalMinutes = targetHour * 60 + targetMinute + jitter;

  // Clamp to valid range (0–1439)
  totalMinutes = Math.max(0, Math.min(1439, totalMinutes));

  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  // Enforce quiet hours
  if (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR) {
    // Shift to the end of quiet hours
    const today = new Date(now);
    today.setHours(QUIET_END_HOUR, 0, 0, 0);
    if (today.getTime() <= now) {
      // Already past 7am, and original time was in quiet hours — skip
      return null;
    }
    return today.getTime();
  }

  // Build the target timestamp for today
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  // If the target time is already past, skip (don't nudge in the past)
  if (target.getTime() <= now) {
    return null;
  }

  return target.getTime();
}

/**
 * Checks backoff logic for a specific activity.
 *
 * Counts consecutive nudges that were NOT acted upon (sent or dismissed).
 * Maps to backoff stages: after 1 ignored → wait 3 days, after 2 → 7 days, etc.
 * After exhausting all stages, stops nudging for this activity.
 */
async function checkBackoff(
  userId: string,
  activityId: string,
): Promise<boolean> {
  // Get recent nudge history for this activity, newest first
  const recentNudges = await database
    .get<NudgeHistory>('nudge_history')
    .query(
      Q.where('user_id', userId),
      Q.where('activity_id', activityId),
      Q.sortBy('nudge_sent_at', 'desc'),
      Q.take(10),
    )
    .fetch();

  if (recentNudges.length === 0) {
    return true; // No history, OK to nudge
  }

  // Count consecutive non-acted nudges (sent/dismissed, not acted/snoozed)
  let consecutiveIgnored = 0;
  for (const nudge of recentNudges) {
    if (nudge.outcome === 'acted') {
      break; // Found a successful nudge, reset count
    }
    if (nudge.outcome === 'sent' || nudge.outcome === 'dismissed') {
      consecutiveIgnored++;
    }
    // 'snoozed' breaks the chain too (user engaged with it)
    if (nudge.outcome === 'snoozed') {
      break;
    }
  }

  if (consecutiveIgnored === 0) {
    return true;
  }

  // Determine which backoff stage we're in (0-indexed)
  const stageIndex = consecutiveIgnored - 1;

  if (stageIndex >= BACKOFF_STAGES.length) {
    return false; // Exhausted all stages — stop nudging
  }

  const cooldownDays = BACKOFF_STAGES[stageIndex];
  const lastNudgeTime = recentNudges[0].nudgeSentAt;
  const daysSinceLastNudge =
    (Date.now() - lastNudgeTime) / (24 * 60 * 60 * 1000);

  return daysSinceLastNudge >= cooldownDays;
}
