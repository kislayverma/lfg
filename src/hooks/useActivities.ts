import {useEffect, useState} from 'react';
import {database, Activity, ActivityLog, Schedule} from '../database';
import {Q} from '@nozbe/watermelondb';
import {normalizeActivityName, randomActivityColor} from '../utils/string';
import {toMidnightTimestamp} from '../utils/date';
import {updateActivityStreak} from '../services/streakEngine';
import {useAuthStore} from '../stores/authStore';

/**
 * Hook to observe all activities for the current user,
 * sorted by last_logged_at descending.
 */
export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) {
      setActivities([]);
      return;
    }

    const collection = database.get<Activity>('activities');
    const subscription = collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('last_logged_at', Q.desc),
      )
      .observe()
      .subscribe(result => {
        setActivities(result);
      });

    return () => subscription.unsubscribe();
  }, [userId]);

  return activities;
}

/**
 * Hook to search activities by prefix match for the current user.
 */
export function useActivitySearch(query: string) {
  const [results, setResults] = useState<Activity[]>([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!query.trim() || !userId) {
      setResults([]);
      return;
    }

    const normalized = normalizeActivityName(query);
    const collection = database.get<Activity>('activities');
    const subscription = collection
      .query(
        Q.where('user_id', userId),
        Q.where(
          'name_normalized',
          Q.like(`${Q.sanitizeLikeString(normalized)}%`),
        ),
        Q.sortBy('last_logged_at', Q.desc),
      )
      .observe()
      .subscribe(result => {
        setResults(result);
      });

    return () => subscription.unsubscribe();
  }, [query, userId]);

  return results;
}

/**
 * Logs an activity for the current user. Creates the activity if it doesn't exist.
 * Returns the streak count after logging.
 */
export async function logActivity(params: {
  name: string;
  date: Date;
  time?: string;
  comment?: string;
  source?: 'manual' | 'scheduled';
  scheduleId?: string;
}): Promise<{activityId: string; streak: number}> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    throw new Error('No authenticated user');
  }

  const normalized = normalizeActivityName(params.name);
  const activitiesCollection = database.get<Activity>('activities');
  const logsCollection = database.get<ActivityLog>('activity_logs');

  // Find or create the activity scoped to current user
  let activity: Activity;
  const existing = await activitiesCollection
    .query(
      Q.where('user_id', userId),
      Q.where('name_normalized', normalized),
    )
    .fetch();

  const logDate = toMidnightTimestamp(params.date);

  if (existing.length > 0) {
    activity = existing[0];
    await database.write(async () => {
      await logsCollection.create(log => {
        log.userId = userId;
        log.activityId = activity.id;
        log.logDate = logDate;
        log.logTime = params.time || null;
        log.comment = params.comment || null;
        log.source = params.source || 'manual';
        log.scheduleId = params.scheduleId || null;
      });
      await activity.update(a => {
        a.lastLoggedAt = Date.now();
      });
    });
  } else {
    await database.write(async () => {
      activity = await activitiesCollection.create(a => {
        a.userId = userId;
        a.name = params.name.trim();
        a.nameNormalized = normalized;
        a.color = randomActivityColor();
        a.icon = null;
        a.currentStreak = 0;
        a.longestStreak = 0;
        a.lastLoggedAt = Date.now();
      });
      await logsCollection.create(log => {
        log.userId = userId;
        log.activityId = activity.id;
        log.logDate = logDate;
        log.logTime = params.time || null;
        log.comment = params.comment || null;
        log.source = params.source || 'manual';
        log.scheduleId = params.scheduleId || null;
      });
    });
  }

  const streak = await updateActivityStreak(activity!.id);
  return {activityId: activity!.id, streak};
}

/**
 * Gets logs for a specific date for the current user.
 */
export function useLogsForDate(date: Date) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) {
      setLogs([]);
      return;
    }

    const timestamp = toMidnightTimestamp(date);
    const collection = database.get<ActivityLog>('activity_logs');
    const subscription = collection
      .query(
        Q.where('user_id', userId),
        Q.where('log_date', timestamp),
      )
      .observe()
      .subscribe(result => {
        setLogs(result);
      });

    return () => subscription.unsubscribe();
  }, [date, userId]);

  return logs;
}

/**
 * Gets all logs for a specific activity.
 */
export function useLogsForActivity(activityId: string) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!activityId) {
      return;
    }

    const collection = database.get<ActivityLog>('activity_logs');
    const subscription = collection
      .query(
        Q.where('activity_id', activityId),
        Q.sortBy('log_date', Q.desc),
      )
      .observe()
      .subscribe(result => {
        setLogs(result);
      });

    return () => subscription.unsubscribe();
  }, [activityId]);

  return logs;
}

/**
 * Gets active schedules for a specific activity.
 */
export function useSchedulesForActivity(activityId: string) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    if (!activityId) {
      return;
    }

    const collection = database.get<Schedule>('schedules');
    const subscription = collection
      .query(
        Q.where('activity_id', activityId),
        Q.where('is_active', true),
      )
      .observe()
      .subscribe(result => {
        setSchedules(result);
      });

    return () => subscription.unsubscribe();
  }, [activityId]);

  return schedules;
}
