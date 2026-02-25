import {database, Activity, ActivityLog, Schedule} from '../database';
import {Q} from '@nozbe/watermelondb';
import {expandRRule} from './rruleHelper';
import {formatDateKey, todayMidnight, previousDay} from '../utils/date';
import {useAuthStore} from '../stores/authStore';
import {pruneOldExceptions} from '../hooks/useSchedule';

/**
 * Calculates the current streak for a given activity.
 *
 * For scheduled activities: counts consecutive scheduled dates
 * (from today backward) that have a matching log entry.
 *
 * For unscheduled activities: counts consecutive calendar days
 * (from today backward) that have a log entry.
 *
 * Optionally accepts pre-fetched schedules and logs to avoid
 * per-activity queries (used by recalculateAllStreaks).
 */
export async function calculateStreak(
  activityId: string,
  prefetchedSchedules?: Schedule[],
  prefetchedLogs?: ActivityLog[],
): Promise<number> {
  let activeSchedules: Schedule[];
  let logs: ActivityLog[];

  if (prefetchedSchedules && prefetchedLogs) {
    activeSchedules = prefetchedSchedules;
    logs = prefetchedLogs;
  } else {
    const schedulesCollection = database.get<Schedule>('schedules');
    const logsCollection = database.get<ActivityLog>('activity_logs');

    activeSchedules = await schedulesCollection
      .query(
        Q.where('activity_id', activityId),
        Q.where('is_active', true),
      )
      .fetch();

    logs = await logsCollection
      .query(
        Q.where('activity_id', activityId),
        Q.sortBy('log_date', Q.desc),
      )
      .fetch();
  }

  // Build a Set of log date keys for O(1) lookup
  const logDateSet = new Set<string>();
  for (const log of logs) {
    logDateSet.add(formatDateKey(new Date(log.logDate)));
  }

  const today = todayMidnight();

  if (activeSchedules.length > 0) {
    return calculateScheduledStreak(activeSchedules, logDateSet, today);
  }

  return calculateUnscheduledStreak(logDateSet, today);
}

function calculateScheduledStreak(
  schedules: Schedule[],
  logDateSet: Set<string>,
  today: Date,
): number {
  // Merge all scheduled dates from all active schedules
  const allScheduledDates: Date[] = [];
  for (const schedule of schedules) {
    const dtstart = new Date(schedule.dtstart);
    const dates = expandRRule(schedule.rrule, dtstart, today);
    allScheduledDates.push(...dates);
  }

  // Sort descending (most recent first), deduplicate by date key
  const seen = new Set<string>();
  const sortedDates = allScheduledDates
    .filter(d => d <= today)
    .sort((a, b) => b.getTime() - a.getTime())
    .filter(d => {
      const key = formatDateKey(d);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  let streak = 0;
  for (const date of sortedDates) {
    const dateKey = formatDateKey(date);
    if (logDateSet.has(dateKey)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateUnscheduledStreak(
  logDateSet: Set<string>,
  today: Date,
): number {
  let streak = 0;
  let currentDate = today;

  while (logDateSet.has(formatDateKey(currentDate))) {
    streak++;
    currentDate = previousDay(currentDate);
  }

  return streak;
}

/**
 * Updates the streak cache on an activity record.
 * Should be called after logging or marking an activity done.
 */
export async function updateActivityStreak(
  activityId: string,
): Promise<number> {
  const currentStreak = await calculateStreak(activityId);
  const activitiesCollection = database.get<Activity>('activities');

  const activity = await activitiesCollection.find(activityId);
  await database.write(async () => {
    await activity.update(a => {
      a.currentStreak = currentStreak;
      if (currentStreak > a.longestStreak) {
        a.longestStreak = currentStreak;
      }
    });
  });

  return currentStreak;
}

/**
 * Recalculates streaks for all activities belonging to the current user.
 * Called on app foreground or by nightly background task.
 */
export async function recalculateAllStreaks(): Promise<void> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    return;
  }

  // Batch-load everything in 3 queries instead of 2N+1
  const [allActivities, allLogs, allSchedules] = await Promise.all([
    database
      .get<Activity>('activities')
      .query(Q.where('user_id', userId))
      .fetch(),
    database
      .get<ActivityLog>('activity_logs')
      .query(Q.where('user_id', userId), Q.sortBy('log_date', Q.desc))
      .fetch(),
    database
      .get<Schedule>('schedules')
      .query(Q.where('user_id', userId), Q.where('is_active', true))
      .fetch(),
  ]);

  // Group logs and schedules by activity_id for O(1) lookup
  const logsByActivity = new Map<string, ActivityLog[]>();
  for (const log of allLogs) {
    const list = logsByActivity.get(log.activityId);
    if (list) {
      list.push(log);
    } else {
      logsByActivity.set(log.activityId, [log]);
    }
  }

  const schedulesByActivity = new Map<string, Schedule[]>();
  for (const schedule of allSchedules) {
    const list = schedulesByActivity.get(schedule.activityId);
    if (list) {
      list.push(schedule);
    } else {
      schedulesByActivity.set(schedule.activityId, [schedule]);
    }
  }

  const updates: any[] = [];

  for (const activity of allActivities) {
    const activityLogs = logsByActivity.get(activity.id) || [];
    const activitySchedules = schedulesByActivity.get(activity.id) || [];

    const currentStreak = await calculateStreak(
      activity.id,
      activitySchedules,
      activityLogs,
    );

    if (
      currentStreak !== activity.currentStreak ||
      currentStreak > activity.longestStreak
    ) {
      updates.push(
        activity.prepareUpdate(a => {
          a.currentStreak = currentStreak;
          if (currentStreak > a.longestStreak) {
            a.longestStreak = currentStreak;
          }
        }),
      );
    }
  }

  if (updates.length > 0) {
    await database.write(async () => {
      await database.batch(...updates);
    });
  }

  // Housekeeping: prune schedule exceptions older than 90 days
  try {
    await pruneOldExceptions();
  } catch (error) {
    console.error('Error pruning old schedule exceptions:', error);
  }
}
