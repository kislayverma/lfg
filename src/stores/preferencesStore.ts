import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';

const storage = createMMKV();

// ── Storage keys ────────────────────────────────────────────────────
const KEY_CALENDAR_SYNC = 'pref_calendar_sync';
const KEY_NOTIFICATIONS_ENABLED = 'pref_notifications_enabled';
const KEY_REMINDER_MINUTES = 'pref_reminder_minutes';
const KEY_CELEBRATION_NOTIFICATIONS = 'pref_celebration_notifications';
const KEY_SMART_NUDGES = 'pref_smart_nudges';

// ── Types ───────────────────────────────────────────────────────────

interface PreferencesState {
  /** Whether new schedules should sync to the native device calendar */
  calendarSyncEnabled: boolean;
  setCalendarSyncEnabled: (enabled: boolean) => void;

  /** Whether push notifications / alarms are enabled globally */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;

  /** Default reminder offset in minutes for new schedules */
  defaultReminderMinutes: number;
  setDefaultReminderMinutes: (minutes: number) => void;

  /** Whether to show celebration notifications on streak milestones */
  celebrationNotificationsEnabled: boolean;
  setCelebrationNotificationsEnabled: (enabled: boolean) => void;

  /** Whether smart nudge notifications are enabled */
  smartNudgesEnabled: boolean;
  setSmartNudgesEnabled: (enabled: boolean) => void;
}

// ── Store ───────────────────────────────────────────────────────────

function readBool(key: string, fallback: boolean): boolean {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return fallback;
  }
  return raw === 'true';
}

export const usePreferencesStore = create<PreferencesState>(set => ({
  calendarSyncEnabled: readBool(KEY_CALENDAR_SYNC, true),
  setCalendarSyncEnabled: (enabled: boolean) => {
    storage.set(KEY_CALENDAR_SYNC, String(enabled));
    set({calendarSyncEnabled: enabled});
  },

  notificationsEnabled: readBool(KEY_NOTIFICATIONS_ENABLED, true),
  setNotificationsEnabled: (enabled: boolean) => {
    storage.set(KEY_NOTIFICATIONS_ENABLED, String(enabled));
    set({notificationsEnabled: enabled});
  },

  defaultReminderMinutes: Number(
    storage.getString(KEY_REMINDER_MINUTES) ?? '15',
  ),
  setDefaultReminderMinutes: (minutes: number) => {
    storage.set(KEY_REMINDER_MINUTES, String(minutes));
    set({defaultReminderMinutes: minutes});
  },

  celebrationNotificationsEnabled: readBool(
    KEY_CELEBRATION_NOTIFICATIONS,
    true,
  ),
  setCelebrationNotificationsEnabled: (enabled: boolean) => {
    storage.set(KEY_CELEBRATION_NOTIFICATIONS, String(enabled));
    set({celebrationNotificationsEnabled: enabled});
  },

  smartNudgesEnabled: readBool(KEY_SMART_NUDGES, true),
  setSmartNudgesEnabled: (enabled: boolean) => {
    storage.set(KEY_SMART_NUDGES, String(enabled));
    set({smartNudgesEnabled: enabled});
  },
}));
