import notifee, {
  TriggerType,
  AndroidImportance,
  AndroidCategory,
  EventType,
  type TimestampTrigger,
  type Event,
} from '@notifee/react-native';
import {NativeModules, Platform} from 'react-native';
import {database, Activity, ActivityLog, Schedule, NudgeHistory} from '../database';
import {Q} from '@nozbe/watermelondb';
import {expandRRule} from './rruleHelper';
import {useAuthStore} from '../stores/authStore';
import {usePreferencesStore} from '../stores/preferencesStore';
import {eventBus} from '../plugins/eventBus';
import {ACTIVITY_LOGGED} from '../plugins/events';
import type {ActivityLoggedPayload} from '../plugins/events';
import {toMidnightTimestamp} from '../utils/date';

const {AlarmModule} = NativeModules;

// ── Channel IDs ──────────────────────────────────────────────────────
export const CHANNEL_REMINDERS = 'habit-reminders';
export const CHANNEL_CELEBRATIONS = 'habit-celebrations';

// ── Notification ID helpers ──────────────────────────────────────────
// Each trigger notification gets a deterministic ID: scheduleId + occurrence timestamp
function triggerNotificationId(
  scheduleId: string,
  occurrenceTimestamp: number,
): string {
  return `reminder-${scheduleId}-${occurrenceTimestamp}`;
}

// How many future occurrences to schedule at once (Android caps at ~50-64)
const BATCH_SIZE = 30;

// ── Setup ────────────────────────────────────────────────────────────

/**
 * Creates Android notification channels. Safe to call on every app launch
 * — channels are only created if they don't already exist.
 * On iOS this is a no-op.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_REMINDERS,
      name: 'Habit Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
    await notifee.createChannel({
      id: CHANNEL_CELEBRATIONS,
      name: 'Streak Celebrations',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/**
 * Requests notification permissions from the user.
 * Returns true if authorized, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1; // AUTHORIZED or PROVISIONAL
}

// ── Scheduling alarms ────────────────────────────────────────────────

/**
 * Schedules the next BATCH_SIZE reminder notifications for a given schedule.
 * Cancels any existing reminders for this schedule before rescheduling.
 */
export async function scheduleReminders(schedule: Schedule): Promise<void> {
  if (schedule.reminderOffset <= 0 || !schedule.isActive) {
    return;
  }

  // Ensure notification channels exist before scheduling
  await setupNotificationChannels();

  // Resolve the display name for the notification
  let activityName: string;
  if (schedule.activityId) {
    const activity = await database
      .get<Activity>('activities')
      .find(schedule.activityId);
    activityName = activity.name;
  } else {
    activityName = schedule.adHocName || 'Scheduled activity';
  }

  const dtstart = new Date(schedule.dtstart);
  const now = new Date();

  // Expand the RRULE to get future occurrences.
  // We look up to 1 year ahead to get enough occurrences.
  const lookAhead = new Date(now);
  lookAhead.setFullYear(lookAhead.getFullYear() + 1);

  const allOccurrences = expandRRule(schedule.rrule, dtstart, lookAhead);

  // Filter to future occurrences only (accounting for reminder offset)
  const reminderOffsetMs = schedule.reminderOffset * 60 * 1000;
  const futureOccurrences = allOccurrences
    .filter(occ => {
      // The occurrence uses the date from RRULE but time from dtstart
      const occTime = applyTimeFromDtstart(occ, dtstart);
      const reminderTime = occTime.getTime() - reminderOffsetMs;
      return reminderTime > now.getTime();
    })
    .slice(0, BATCH_SIZE);

  if (futureOccurrences.length === 0) {
    return;
  }

  // Check permission — don't request here (requesting shows a native dialog
  // that can crash if called during navigation). Permissions are requested
  // upfront on first schedule creation from the UI.
  const settings = await notifee.getNotificationSettings();
  if (settings.authorizationStatus < 1) {
    return;
  }

  // Schedule each occurrence as a timestamp trigger
  for (const occurrence of futureOccurrences) {
    const occTime = applyTimeFromDtstart(occurrence, dtstart);
    const reminderTimestamp = occTime.getTime() - reminderOffsetMs;

    const notificationId = triggerNotificationId(
      schedule.id,
      occTime.getTime(),
    );

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: reminderTimestamp,
      alarmManager:
        Platform.OS === 'android' ? {type: 2} : undefined, // SET_EXACT
    };

    const isAdHoc = !schedule.activityId;

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: `Time for ${activityName}`,
        body: formatReminderBody(schedule.reminderOffset),
        data: {
          scheduleId: schedule.id,
          ...(schedule.activityId
            ? {activityId: schedule.activityId}
            : {}),
          occurrenceTimestamp: occTime.getTime(),
        },
        android: {
          channelId: CHANNEL_REMINDERS,
          category: AndroidCategory.ALARM,
          pressAction: {id: 'default'},
          // Only show "Mark Done" for habit schedules (not ad-hoc)
          ...(!isAdHoc && {
            actions: [
              {
                title: 'Mark Done',
                pressAction: {id: 'mark-done'},
              },
            ],
          }),
          smallIcon: 'ic_notification',
          importance: AndroidImportance.HIGH,
        },
        ios: {
          categoryId: isAdHoc ? undefined : 'habit-reminder',
          sound: 'default',
        },
      },
      trigger,
    );
  }
}

/**
 * Cancels all pending reminder notifications for a specific schedule.
 */
export async function cancelRemindersForSchedule(
  scheduleId: string,
): Promise<void> {
  const triggerIds = await notifee.getTriggerNotificationIds();
  const toCancel = triggerIds.filter(id =>
    id.startsWith(`reminder-${scheduleId}-`),
  );

  for (const id of toCancel) {
    await notifee.cancelTriggerNotification(id);
  }
}

/**
 * Cancels a single pending reminder notification for a specific occurrence.
 */
export async function cancelReminderForOccurrence(
  scheduleId: string,
  occurrenceTimestamp: number,
): Promise<void> {
  const id = triggerNotificationId(scheduleId, occurrenceTimestamp);
  try {
    await notifee.cancelTriggerNotification(id);
  } catch {
    // Notification may not exist (already fired or never scheduled) — ignore
  }
}

/**
 * Replenishes reminders for all active schedules.
 * Called when the background handler detects few remaining triggers.
 */
export async function replenishAllReminders(): Promise<void> {
  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    return;
  }

  // Skip if notifications are globally disabled
  if (!usePreferencesStore.getState().notificationsEnabled) {
    return;
  }

  const schedules = await database
    .get<Schedule>('schedules')
    .query(
      Q.where('user_id', userId),
      Q.where('is_active', true),
      Q.where('reminder_offset', Q.gt(0)),
    )
    .fetch();

  for (const schedule of schedules) {
    await cancelRemindersForSchedule(schedule.id);
    await scheduleReminders(schedule);
  }
}

// ── iOS category setup ───────────────────────────────────────────────

/**
 * Sets up iOS notification categories with actions.
 * Must be called on app startup.
 */
export async function setupIOSCategories(): Promise<void> {
  if (Platform.OS === 'ios') {
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
    ]);
  }
}

// ── Event handlers ───────────────────────────────────────────────────

/**
 * Handles notification events (both foreground and background).
 * The "Mark Done" action creates an activity log and updates the streak.
 */
export async function handleNotificationEvent(event: Event): Promise<void> {
  const {type, detail} = event;

  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'mark-done') {
    const data = detail.notification?.data;
    if (!data?.activityId || !data?.occurrenceTimestamp) {
      return;
    }

    const activityId = data.activityId as string;
    const occurrenceTimestamp = data.occurrenceTimestamp as number;
    const scheduleId = (data.scheduleId as string) || null;

    try {
      const userId = useAuthStore.getState().currentUser?.id;
      if (!userId) {
        return;
      }

      const logDate = toMidnightTimestamp(new Date(occurrenceTimestamp));
      const logsCollection = database.get<ActivityLog>('activity_logs');
      const activitiesCollection = database.get<Activity>('activities');
      const activity = await activitiesCollection.find(activityId);

      await database.write(async () => {
        await logsCollection.create(log => {
          log.userId = userId;
          log.activityId = activityId;
          log.logDate = logDate;
          log.logTime = null;
          log.comment = null;
          log.source = 'scheduled';
          log.scheduleId = scheduleId;
        });
        await activity.update(a => {
          a.lastLoggedAt = Date.now();
        });
      });

      // Emit event so streaks plugin can update the streak
      eventBus.emit<ActivityLoggedPayload>(ACTIVITY_LOGGED, {
        activityId,
        logDate,
        source: 'notification',
      });
    } catch (error) {
      console.error('Error handling Mark Done action:', error);
    }
  }

  // ── Smart nudge: "Log it now" action ──
  if (
    type === EventType.ACTION_PRESS &&
    detail.pressAction?.id === 'nudge-log'
  ) {
    const data = detail.notification?.data;
    if (!data?.activityId) {
      return;
    }

    const activityId = data.activityId as string;
    const nudgeDate = (data.nudgeDate as number) || toMidnightTimestamp(new Date());

    try {
      const userId = useAuthStore.getState().currentUser?.id;
      if (!userId) {
        return;
      }

      const logsCollection = database.get<ActivityLog>('activity_logs');
      const activitiesCollection = database.get<Activity>('activities');
      const activity = await activitiesCollection.find(activityId);

      await database.write(async () => {
        await logsCollection.create(log => {
          log.userId = userId;
          log.activityId = activityId;
          log.logDate = nudgeDate;
          log.logTime = null;
          log.comment = null;
          log.source = 'scheduled';
          log.scheduleId = null;
        });
        await activity.update(a => {
          a.lastLoggedAt = Date.now();
        });
      });

      // Update nudge history to 'acted'
      await updateNudgeOutcome(
        detail.notification?.id || null,
        'acted',
      );

      eventBus.emit<ActivityLoggedPayload>(ACTIVITY_LOGGED, {
        activityId,
        logDate: nudgeDate,
        source: 'notification',
      });
    } catch (error) {
      console.error('Error handling nudge Log it now action:', error);
    }
  }

  // ── Smart nudge: "Snooze 1hr" action ──
  if (
    type === EventType.ACTION_PRESS &&
    detail.pressAction?.id === 'nudge-snooze'
  ) {
    const data = detail.notification?.data;
    if (!data?.activityId) {
      return;
    }

    try {
      const activityId = data.activityId as string;
      const snoozeUntil = Date.now() + 60 * 60 * 1000; // 1 hour from now

      // Reschedule the same notification 1 hour later
      const snoozeNotificationId = `nudge-snooze-${activityId}-${Date.now()}`;

      let activityName: string;
      try {
        const activity = await database
          .get<Activity>('activities')
          .find(activityId);
        activityName = activity.name;
      } catch {
        activityName = 'your activity';
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: snoozeUntil,
      };

      await notifee.createTriggerNotification(
        {
          id: snoozeNotificationId,
          title: `Reminder: ${activityName}`,
          body: 'Snoozed nudge — ready now?',
          data: {
            type: 'smart-nudge',
            activityId,
            nudgeDate: data.nudgeDate || toMidnightTimestamp(new Date()),
          },
          android: {
            channelId: 'smart-nudges',
            pressAction: {id: 'default'},
            actions: [
              {
                title: 'Log it now',
                pressAction: {id: 'nudge-log'},
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

      // Update nudge history to 'snoozed'
      await updateNudgeOutcome(
        detail.notification?.id || null,
        'snoozed',
      );
    } catch (error) {
      console.error('Error handling nudge Snooze action:', error);
    }
  }

  // Replenish triggers if running low
  if (type === EventType.DELIVERED) {
    try {
      const pendingIds = await notifee.getTriggerNotificationIds();
      if (pendingIds.length < 10) {
        await replenishAllReminders();
      }
    } catch (error) {
      console.error('Error replenishing reminders:', error);
    }
  }
}

// ── Android system alarm creation ────────────────────────────────────

/**
 * Creates a system alarm (visible in the clock app) for a schedule.
 * Maps RRULE days to Android Calendar day constants.
 */
export async function createSystemAlarm(
  schedule: Schedule,
  activityName: string,
): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmModule) {
    return;
  }

  try {
    const dtstart = new Date(schedule.dtstart);

    // Subtract the reminder offset so the alarm rings BEFORE the activity
    const reminderTime = new Date(
      dtstart.getTime() - schedule.reminderOffset * 60 * 1000,
    );
    const hour = reminderTime.getHours();
    const minute = reminderTime.getMinutes();

    // Parse RRULE to extract BYDAY for recurring alarm days
    // Android Calendar constants: SU=1, MO=2, TU=3, WE=4, TH=5, FR=6, SA=7
    const rruleDays = parseRRuleDays(schedule.rrule);

    const label =
      schedule.reminderOffset > 0
        ? `${activityName} in ${formatReminderBody(schedule.reminderOffset).replace('Starting in ', '')}`
        : activityName;

    await AlarmModule.setAlarm(
      hour,
      minute,
      label,
      rruleDays.length > 0 ? rruleDays : null,
    );
  } catch (error) {
    console.error('Error creating system alarm:', error);
  }
}

/**
 * Parses BYDAY from an RRULE string and returns Android Calendar day constants.
 * RRULE uses MO,TU,WE,TH,FR,SA,SU → Android uses SU=1,MO=2,...,SA=7
 */
function parseRRuleDays(rrule: string): number[] {
  const cleaned = rrule.replace(/^RRULE:/, '');
  const parts: Record<string, string> = {};
  for (const segment of cleaned.split(';')) {
    const [key, value] = segment.split('=');
    if (key && value) {
      parts[key] = value;
    }
  }

  if (!parts.BYDAY) {
    // For daily schedules, return all 7 days
    if (parts.FREQ === 'DAILY') {
      return [1, 2, 3, 4, 5, 6, 7];
    }
    return [];
  }

  const dayMap: Record<string, number> = {
    SU: 1,
    MO: 2,
    TU: 3,
    WE: 4,
    TH: 5,
    FR: 6,
    SA: 7,
  };

  return parts.BYDAY.split(',')
    .map(d => dayMap[d.trim()])
    .filter(Boolean);
}

// ── Foreground event subscription ────────────────────────────────────

/**
 * Registers the foreground event listener.
 * Returns an unsubscribe function.
 */
export function subscribeForegroundEvents(): () => void {
  return notifee.onForegroundEvent(event => {
    // Fire-and-forget — foreground handler does not need to return a promise
    handleNotificationEvent(event);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Applies the hours and minutes from dtstart to an RRULE-expanded date
 * (which may only have the correct date but midnight time).
 */
function applyTimeFromDtstart(occurrence: Date, dtstart: Date): Date {
  const result = new Date(occurrence);
  result.setHours(dtstart.getHours(), dtstart.getMinutes(), 0, 0);
  return result;
}

function formatReminderBody(offsetMinutes: number): string {
  if (offsetMinutes >= 60) {
    const hours = Math.floor(offsetMinutes / 60);
    return `Starting in ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `Starting in ${offsetMinutes} minutes`;
}

/**
 * Updates the outcome of a nudge in the nudge_history table.
 * Matches by notification_id.
 */
async function updateNudgeOutcome(
  notificationId: string | null,
  outcome: 'acted' | 'snoozed' | 'dismissed',
): Promise<void> {
  if (!notificationId) {
    return;
  }

  try {
    const records = await database
      .get<NudgeHistory>('nudge_history')
      .query(Q.where('notification_id', notificationId))
      .fetch();

    if (records.length > 0) {
      await database.write(async () => {
        await records[0].update(r => {
          r.outcome = outcome;
        });
      });
    }
  } catch (error) {
    console.error('Error updating nudge outcome:', error);
  }
}
