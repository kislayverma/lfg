import RNCalendarEvents from 'react-native-calendar-events';
import type {
  RecurrenceFrequency,
  RecurrenceRule,
} from 'react-native-calendar-events';
import {Platform} from 'react-native';
import type {Schedule} from '../database';

const LFG_CALENDAR_NAME = 'LFG';
const LFG_CALENDAR_COLOR = '#FF5F1F';

// ── Permission ───────────────────────────────────────────────────────

/**
 * Requests calendar read/write permissions.
 * Returns true if granted, false otherwise.
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const status = await RNCalendarEvents.requestPermissions();
  return status === 'authorized';
}

// ── Calendar management ──────────────────────────────────────────────

/**
 * Returns the ID of the "LFG" calendar on the device, creating it if necessary.
 * Returns null if permission is denied.
 */
async function getOrCreateLFGCalendar(): Promise<string | null> {
  // Check permission — don't request here (requesting shows a native dialog
  // that can crash if called during navigation). Permissions are requested
  // upfront before schedule creation from the UI.
  const status = await RNCalendarEvents.checkPermissions();
  if (status !== 'authorized') {
    return null;
  }

  const calendars = await RNCalendarEvents.findCalendars();

  // Look for existing LFG calendar
  const existing = calendars.find(
    c => c.title === LFG_CALENDAR_NAME && c.allowsModifications,
  );
  if (existing) {
    return existing.id;
  }

  // Create a new one
  try {
    if (Platform.OS === 'ios') {
      const calendarId = await RNCalendarEvents.saveCalendar({
        title: LFG_CALENDAR_NAME,
        color: LFG_CALENDAR_COLOR,
        entityType: 'event',
        // These are Android-only but required by the type — provide defaults
        name: LFG_CALENDAR_NAME,
        accessLevel: 'owner',
        ownerAccount: 'LFG',
        source: {name: LFG_CALENDAR_NAME, isLocalAccount: true},
      });
      return calendarId;
    }

    // Android — try to attach to the user's primary Google (or other) account
    // so the calendar is visible in Google Calendar.
    const primaryCal =
      calendars.find(c => c.isPrimary && c.allowsModifications) ||
      calendars.find(
        c => c.type === 'com.google' && c.allowsModifications,
      ) ||
      calendars.find(c => c.allowsModifications);

    let calendarId: string;
    if (primaryCal) {
      calendarId = await RNCalendarEvents.saveCalendar({
        title: LFG_CALENDAR_NAME,
        color: LFG_CALENDAR_COLOR,
        entityType: 'event',
        name: LFG_CALENDAR_NAME,
        accessLevel: 'owner',
        ownerAccount: primaryCal.source,
        source: {
          name: primaryCal.source,
          type: primaryCal.type,
        },
      });
    } else {
      // No existing account found — create as a local calendar
      calendarId = await RNCalendarEvents.saveCalendar({
        title: LFG_CALENDAR_NAME,
        color: LFG_CALENDAR_COLOR,
        entityType: 'event',
        name: LFG_CALENDAR_NAME,
        accessLevel: 'owner',
        ownerAccount: LFG_CALENDAR_NAME,
        source: {
          name: LFG_CALENDAR_NAME,
          isLocalAccount: true,
        },
      });
    }
    return calendarId;
  } catch (error) {
    console.error('Error creating LFG calendar:', error);
    return null;
  }
}

// ── RRULE → RecurrenceRule conversion ────────────────────────────────

/**
 * Parses an RFC 5545 RRULE string into a react-native-calendar-events
 * RecurrenceRule object. Returns the recurrence frequency and rule, or null.
 */
function parseRRuleToRecurrence(rrule: string): {
  recurrence: RecurrenceFrequency;
  recurrenceRule: RecurrenceRule;
} | null {
  const parts: Record<string, string> = {};
  const cleaned = rrule.replace(/^RRULE:/, '');
  for (const segment of cleaned.split(';')) {
    const [key, value] = segment.split('=');
    if (key && value) {
      parts[key] = value;
    }
  }

  const freqMap: Record<string, RecurrenceFrequency> = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  };

  const freq = parts.FREQ;
  if (!freq || !freqMap[freq]) {
    return null;
  }

  const frequency = freqMap[freq];

  const rule: RecurrenceRule = {
    frequency,
    interval: parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1,
    occurrence: parts.COUNT ? parseInt(parts.COUNT, 10) : undefined,
  };

  if (parts.UNTIL) {
    // UNTIL is formatted like 20260331T235959Z
    const u = parts.UNTIL;
    const year = parseInt(u.slice(0, 4), 10);
    const month = parseInt(u.slice(4, 6), 10) - 1;
    const day = parseInt(u.slice(6, 8), 10);
    rule.endDate = new Date(year, month, day).toISOString();
  }

  return {recurrence: frequency, recurrenceRule: rule};
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Creates a native calendar event for a schedule.
 * Returns the native event ID, or null if calendar access is denied.
 */
export async function syncScheduleToCalendar(
  schedule: Schedule,
  activityName: string,
): Promise<string | null> {
  try {
    const calendarId = await getOrCreateLFGCalendar();
    if (!calendarId) {
      return null;
    }

    const startDate = new Date(schedule.dtstart);
    const endDate = new Date(
      startDate.getTime() + schedule.durationMinutes * 60 * 1000,
    );

    const parsed = parseRRuleToRecurrence(schedule.rrule);
    const isRecurring = !!parsed;

    const alarms: Array<{date: number}> = [];
    if (schedule.reminderOffset > 0) {
      // Negative number = minutes before event
      alarms.push({date: -schedule.reminderOffset});
    }

    // Android CalendarProvider forbids DTEND + DURATION on the same event.
    // For recurring events it requires DURATION (no DTEND), so we omit endDate
    // on Android when a recurrence rule is present.
    const eventId = await RNCalendarEvents.saveEvent(activityName, {
      calendarId,
      startDate: startDate.toISOString(),
      ...(Platform.OS === 'android' && isRecurring
        ? {duration: formatDuration(schedule.durationMinutes)}
        : {endDate: endDate.toISOString()}),
      ...(Platform.OS === 'ios'
        ? {
            notes: 'Tracked by LFG',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : {description: 'Tracked by LFG'}),
      recurrence: parsed?.recurrence,
      recurrenceRule: parsed?.recurrenceRule,
      alarms,
    });

    return eventId;
  } catch (error) {
    console.error('Error syncing schedule to calendar:', error);
    return null;
  }
}

/**
 * Removes a native calendar event for a schedule.
 */
export async function removeScheduleFromCalendar(
  nativeEventId: string | null,
): Promise<void> {
  if (!nativeEventId) {
    return;
  }

  try {
    await RNCalendarEvents.removeEvent(nativeEventId);
  } catch (error) {
    // Event may have been manually deleted by user — not an error worth surfacing
    console.warn('Could not delete calendar event:', error);
  }
}

/**
 * Updates a native calendar event (e.g., after editing a schedule).
 */
export async function updateCalendarEvent(
  nativeEventId: string,
  schedule: Schedule,
  activityName: string,
): Promise<void> {
  try {
    const startDate = new Date(schedule.dtstart);
    const endDate = new Date(
      startDate.getTime() + schedule.durationMinutes * 60 * 1000,
    );

    const parsed = parseRRuleToRecurrence(schedule.rrule);
    const isRecurring = !!parsed;

    const alarms: Array<{date: number}> = [];
    if (schedule.reminderOffset > 0) {
      alarms.push({date: -schedule.reminderOffset});
    }

    await RNCalendarEvents.saveEvent(activityName, {
      id: nativeEventId,
      startDate: startDate.toISOString(),
      ...(Platform.OS === 'android' && isRecurring
        ? {duration: formatDuration(schedule.durationMinutes)}
        : {endDate: endDate.toISOString()}),
      ...(Platform.OS === 'ios'
        ? {
            notes: 'Tracked by LFG',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : {description: 'Tracked by LFG'}),
      recurrence: parsed?.recurrence,
      recurrenceRule: parsed?.recurrenceRule,
      alarms,
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
  }
}

/**
 * Converts minutes to an RFC 2445 duration string (e.g. 90 → "PT1H30M").
 * Required by Android CalendarProvider for recurring events.
 */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `PT${h}H${m}M`;
  }
  if (h > 0) {
    return `PT${h}H`;
  }
  return `PT${m}M`;
}
