import {useState, useEffect, useMemo} from 'react';
import {database, Activity, Schedule, ScheduleException} from '../database';
import {Q} from '@nozbe/watermelondb';
import {expandRRule} from '../services/rruleHelper';
import {formatDateKey, toMidnightTimestamp} from '../utils/date';
import {useAuthStore} from '../stores/authStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {
  scheduleReminders,
  cancelRemindersForSchedule,
  cancelReminderForOccurrence,
  createSystemAlarm,
} from '../services/notifications';
import {
  syncScheduleToCalendar,
  removeScheduleFromCalendar,
} from '../services/calendarSync';

/**
 * Returns all scheduled activities for a given date for the current user,
 * filtering out skipped instances via schedule_exceptions.
 */
export function useSchedulesForDate(dateOrKey: Date | string) {
  const [scheduledItems, setScheduledItems] = useState<
    Array<{schedule: Schedule; activityId: string | null}>
  >([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  // Normalize to a stable string key
  const dateKey =
    typeof dateOrKey === 'string' ? dateOrKey : formatDateKey(dateOrKey);

  // Parse date from key for RRULE expansion
  const dateForExpansion = useMemo(() => {
    const parts = dateKey.split('-');
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
  }, [dateKey]);

  const dateMidnight = useMemo(
    () => toMidnightTimestamp(dateForExpansion),
    [dateForExpansion],
  );

  useEffect(() => {
    if (!userId) {
      setScheduledItems([]);
      return;
    }

    const scheduleCollection = database.get<Schedule>('schedules');
    const exceptionCollection =
      database.get<ScheduleException>('schedule_exceptions');

    const scheduleSub = scheduleCollection
      .query(
        Q.where('user_id', userId),
        Q.where('is_active', true),
      )
      .observe()
      .subscribe(allSchedules => {
        // First pass: find schedules that have an occurrence on this date
        const candidates: Array<{
          schedule: Schedule;
          activityId: string | null;
        }> = [];

        for (const schedule of allSchedules) {
          const dtstart = new Date(schedule.dtstart);
          const occurrences = expandRRule(
            schedule.rrule,
            dtstart,
            dateForExpansion,
          );
          const hasOccurrence = occurrences.some(
            occ => formatDateKey(occ) === dateKey,
          );
          if (hasOccurrence) {
            candidates.push({
              schedule,
              activityId: schedule.activityId,
            });
          }
        }

        if (candidates.length === 0) {
          setScheduledItems([]);
          return;
        }

        // Only query exceptions for schedules that actually match this date
        const candidateIds = candidates.map(c => c.schedule.id);
        exceptionCollection
          .query(
            Q.where('schedule_id', Q.oneOf(candidateIds)),
            Q.where('exception_date', dateMidnight),
            Q.where('exception_type', 'skip'),
          )
          .fetch()
          .then(exceptions => {
            const skippedScheduleIds = new Set(
              exceptions.map(e => e.scheduleId),
            );
            setScheduledItems(
              candidates.filter(c => !skippedScheduleIds.has(c.schedule.id)),
            );
          })
          .catch(err => {
            console.error('Error fetching schedule exceptions:', err);
          });
      });

    return () => scheduleSub.unsubscribe();
  }, [dateKey, dateForExpansion, dateMidnight, userId]);

  return scheduledItems;
}

/**
 * Skip a single occurrence of a schedule on a given date.
 * Also cancels the pending notification for that specific occurrence.
 */
export async function skipScheduleInstance(
  scheduleId: string,
  date: Date,
): Promise<void> {
  const midnight = toMidnightTimestamp(date);
  const collection = database.get<ScheduleException>('schedule_exceptions');

  await database.write(async () => {
    await collection.create(e => {
      e.scheduleId = scheduleId;
      e.exceptionDate = midnight;
      e.exceptionType = 'skip';
      e.newDtstart = null;
      e.newDuration = null;
    });
  });

  // Cancel the notification for this specific occurrence
  try {
    const schedule = await database.get<Schedule>('schedules').find(scheduleId);
    const dtstart = new Date(schedule.dtstart);
    // Build the occurrence timestamp: date from the skipped day, time from dtstart
    const occTime = new Date(date);
    occTime.setHours(dtstart.getHours(), dtstart.getMinutes(), 0, 0);
    await cancelReminderForOccurrence(scheduleId, occTime.getTime());
  } catch (error) {
    console.error('Error cancelling notification for skipped occurrence:', error);
  }
}

/**
 * Skip this and all future occurrences.
 *
 * If fromDate is the start date (or earlier), the schedule is fully
 * deactivated. Otherwise the untilDate is set to the day before fromDate.
 *
 * In both cases we cancel all pending reminder notifications and remove
 * the native calendar event so the user sees a clean slate.
 */
export async function skipAllFutureInstances(
  scheduleId: string,
  fromDate: Date,
): Promise<void> {
  const schedule = await database.get<Schedule>('schedules').find(scheduleId);

  const fromMidnight = toMidnightTimestamp(fromDate);
  const dtstartMidnight = toMidnightTimestamp(new Date(schedule.dtstart));

  // If skipping from the very start (or before), deactivate entirely
  const shouldDeactivate = fromMidnight <= dtstartMidnight;

  if (shouldDeactivate) {
    await database.write(async () => {
      await schedule.update(s => {
        s.isActive = false;
      });
    });
  } else {
    // Set until_date to the day before fromDate
    const dayBefore = new Date(fromDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const untilTs = toMidnightTimestamp(dayBefore);

    await database.write(async () => {
      await schedule.update(s => {
        s.untilDate = untilTs;
      });
    });
  }

  // Cancel all pending reminder notifications — do NOT reschedule
  try {
    await cancelRemindersForSchedule(scheduleId);
  } catch (error) {
    console.error('Error cancelling reminders after skip-all:', error);
  }

  // Remove from native calendar
  try {
    await removeScheduleFromCalendar(schedule.nativeCalendarEventId);
    // Clear the stored native event ID
    if (schedule.nativeCalendarEventId) {
      await database.write(async () => {
        await schedule.update(s => {
          s.nativeCalendarEventId = null;
        });
      });
    }
  } catch (error) {
    console.error('Error removing calendar event after skip-all:', error);
  }
}

/**
 * Creates a new schedule, scoped to the current user.
 *
 * For recurring (habit) schedules, pass `activityId`.
 * For one-time ad-hoc schedules, pass `adHocName` instead — no Activity
 * record is created and the schedule won't appear in the Activities or
 * Streaks tabs.
 */
export async function createSchedule(params: {
  activityId?: string | null;
  adHocName?: string | null;
  rrule: string;
  dtstart: Date;
  durationMinutes: number;
  reminderOffset: number;
  untilDate?: Date;
}): Promise<Schedule> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    throw new Error('No authenticated user');
  }

  const displayName = params.adHocName || 'Scheduled activity';

  const collection = database.get<Schedule>('schedules');

  let schedule: Schedule;
  await database.write(async () => {
    schedule = await collection.create(s => {
      s.userId = userId;
      s.activityId = params.activityId || null;
      s.adHocName = params.adHocName || null;
      s.rrule = params.rrule;
      s.dtstart = params.dtstart.getTime();
      s.durationMinutes = params.durationMinutes;
      s.reminderOffset = params.reminderOffset;
      s.untilDate = params.untilDate ? params.untilDate.getTime() : null;
      s.isActive = true;
      s.nativeCalendarEventId = null;
    });
  });

  // Resolve the name to use for calendar/alarm entries
  let eventName = displayName;
  if (params.activityId) {
    try {
      const activity = await database
        .get<Activity>('activities')
        .find(params.activityId);
      eventName = activity.name;
    } catch {
      // Activity lookup failed — fall back to displayName
    }
  }

  const prefs = usePreferencesStore.getState();

  // Schedule alarm notifications if a reminder offset is set and notifications are enabled
  if (params.reminderOffset > 0 && prefs.notificationsEnabled) {
    try {
      await scheduleReminders(schedule!);
    } catch (error) {
      console.error('Error scheduling reminders:', error);
    }
  }

  // Create a system alarm on Android (visible in the clock app)
  try {
    await createSystemAlarm(schedule!, eventName);
  } catch (error) {
    console.error('Error creating system alarm:', error);
  }

  // Sync to native calendar if enabled
  if (prefs.calendarSyncEnabled) {
    try {
      const nativeEventId = await syncScheduleToCalendar(
        schedule!,
        eventName,
      );
      if (nativeEventId) {
        await database.write(async () => {
          await schedule!.update(s => {
            s.nativeCalendarEventId = nativeEventId;
          });
        });
      }
    } catch (error) {
      console.error('Error syncing to native calendar:', error);
    }
  }

  return schedule!;
}

/**
 * Deactivates a schedule.
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const collection = database.get<Schedule>('schedules');
  const schedule = await collection.find(scheduleId);

  // Cancel any pending reminder notifications for this schedule
  try {
    await cancelRemindersForSchedule(scheduleId);
  } catch (error) {
    console.error('Error cancelling reminders:', error);
  }

  // Remove from native calendar
  try {
    await removeScheduleFromCalendar(schedule.nativeCalendarEventId);
  } catch (error) {
    console.error('Error removing calendar event:', error);
  }

  await database.write(async () => {
    await schedule.update(s => {
      s.isActive = false;
    });
  });
}

/**
 * Deletes schedule_exceptions older than `daysToKeep` days.
 * Call periodically (e.g. on app foreground) to prevent unbounded table growth.
 */
export async function pruneOldExceptions(daysToKeep = 90): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffTs = toMidnightTimestamp(cutoff);

  const collection = database.get<ScheduleException>('schedule_exceptions');
  const old = await collection
    .query(Q.where('exception_date', Q.lt(cutoffTs)))
    .fetch();

  if (old.length === 0) {
    return;
  }

  await database.write(async () => {
    await database.batch(
      ...old.map(record => record.prepareDestroyPermanently()),
    );
  });
}
