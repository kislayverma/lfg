/**
 * Event name constants and payload types for the LFG event bus.
 *
 * All cross-plugin communication uses these typed events.
 * Plugins should import event names from here rather than
 * using raw strings.
 */

// ── Activity Events ─────────────────────────────────────────────────

export const ACTIVITY_CREATED = 'activity.created';
export const ACTIVITY_DELETED = 'activity.deleted';
export const ACTIVITY_LOGGED = 'activity.logged';

export interface ActivityCreatedPayload {
  activityId: string;
  name: string;
}

export interface ActivityDeletedPayload {
  activityId: string;
}

export interface ActivityLoggedPayload {
  activityId: string;
  logDate: number;
  source: string; // 'manual' | 'notification' | 'calendar'
}

// ── Schedule Events ─────────────────────────────────────────────────

export const SCHEDULE_CREATED = 'schedule.created';
export const SCHEDULE_SKIPPED = 'schedule.skipped';
export const SCHEDULE_DEACTIVATED = 'schedule.deactivated';

export interface ScheduleCreatedPayload {
  scheduleId: string;
  activityId?: string;
  adHocName?: string;
}

export interface ScheduleSkippedPayload {
  scheduleId: string;
  date: number;
}

export interface ScheduleDeactivatedPayload {
  scheduleId: string;
}

// ── Streak Events ───────────────────────────────────────────────────

export const STREAK_UPDATED = 'streak.updated';
export const STREAK_MILESTONE = 'streak.milestone';

export interface StreakUpdatedPayload {
  activityId: string;
  current: number;
  longest: number;
}

export interface StreakMilestonePayload {
  activityId: string;
  streak: number;
  name: string;
}

// ── Journal Events ──────────────────────────────────────────────────

export const JOURNAL_PAGE_CREATED = 'journal.page.created';
export const JOURNAL_PAGE_SAVED = 'journal.page.saved';
export const JOURNAL_LINK_ADDED = 'journal.link.added';

export interface JournalPageCreatedPayload {
  pageId: string;
  title: string;
  pageType: string;
}

export interface JournalPageSavedPayload {
  pageId: string;
  title: string;
}

export interface JournalLinkAddedPayload {
  sourcePageId: string;
  targetTitle: string;
}

// ── App Lifecycle Events ────────────────────────────────────────────

export const APP_FOREGROUND = 'app.foreground';
export const APP_BACKGROUND = 'app.background';
export const AUTH_LOGIN = 'auth.login';
export const AUTH_LOGOUT = 'auth.logout';

export interface AppLifecyclePayload {
  timestamp: number;
}

export interface AuthLoginPayload {
  userId: string;
}

// ── Plugin Events ───────────────────────────────────────────────────

export const PLUGIN_ENABLED = 'plugin.enabled';
export const PLUGIN_DISABLED = 'plugin.disabled';

export interface PluginEventPayload {
  pluginId: string;
}
