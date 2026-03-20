/**
 * Calendar & Scheduling Plugin Manifest.
 *
 * Provides the main calendar view, schedule creation, and deep-link
 * share receiving. Owns the schedules and schedule_exceptions tables.
 * Also manages notification setup, background reminders, and native
 * calendar sync.
 */

import {tableSchema} from '@nozbe/watermelondb';
import type {PluginManifest} from '../../plugins/types';
import Schedule from '../../database/models/Schedule';
import ScheduleException from '../../database/models/ScheduleException';
import CalendarScreen from './CalendarScreen';
import ScheduleActivityScreen from './ScheduleActivityScreen';
import ReceiveShareScreen from '../../features/sharing/ReceiveShareScreen';
import {
  setupNotificationChannels,
  setupIOSCategories,
  subscribeForegroundEvents,
  replenishAllReminders,
} from '../../services/notifications';
import {configureBackgroundFetch} from '../../services/backgroundTasks';

export const calendarPlugin: PluginManifest = {
  id: 'com.lfg.calendar',
  name: 'Calendar & Scheduling',
  description:
    'Plan and track daily habits with recurring schedules, reminders, ' +
    'and native calendar sync. The main Home tab.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F3E0}', // house
  isCore: true,

  // ── Database ──────────────────────────────────────────────────────
  tables: [
    tableSchema({
      name: 'schedules',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {
          name: 'activity_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        {name: 'ad_hoc_name', type: 'string', isOptional: true},
        {name: 'rrule', type: 'string'},
        {name: 'dtstart', type: 'number'},
        {name: 'duration_minutes', type: 'number'},
        {name: 'reminder_offset', type: 'number'},
        {name: 'until_date', type: 'number', isOptional: true},
        {name: 'is_active', type: 'boolean', isIndexed: true},
        {name: 'native_calendar_event_id', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'schedule_exceptions',
      columns: [
        {name: 'schedule_id', type: 'string', isIndexed: true},
        {name: 'exception_date', type: 'number', isIndexed: true},
        {name: 'exception_type', type: 'string'},
        {name: 'new_dtstart', type: 'number', isOptional: true},
        {name: 'new_duration', type: 'number', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
  modelClasses: [Schedule as any, ScheduleException as any],

  // ── Navigation ────────────────────────────────────────────────────
  tabRegistration: {
    label: 'Home',
    icon: {active: '\u{1F3E0}', inactive: '\u{1F3E0}'},
    order: 10,
    stack: [
      {
        name: 'Calendar',
        component: CalendarScreen,
        options: {headerShown: false},
      },
      {
        name: 'LogActivity',
        component: require('../activities/LogActivityScreen').default,
        options: {
          presentation: 'modal' as const,
          headerShown: true,
          headerTitle: 'Log Activity',
        },
      },
      {
        name: 'ScheduleActivity',
        component: ScheduleActivityScreen,
        options: {
          presentation: 'modal' as const,
          headerShown: true,
          headerTitle: 'Schedule Activity',
        },
      },
      {
        name: 'ReceiveShare',
        component: ReceiveShareScreen,
        options: {
          presentation: 'modal' as const,
          headerShown: true,
          headerTitle: 'Shared Activity',
        },
      },
    ],
  },

  // ── Lifecycle ─────────────────────────────────────────────────────
  onActivate(_context) {
    // Set up notification channels (Android) and iOS categories
    setupNotificationChannels();
    setupIOSCategories();

    // Subscribe to foreground notification events
    const unsubscribeNotifications = subscribeForegroundEvents();

    // Configure background fetch
    configureBackgroundFetch().catch(err =>
      console.error('[CalendarPlugin] background fetch config error:', err),
    );

    return () => {
      unsubscribeNotifications();
    };
  },

  onBackgroundTask: async () => {
    await replenishAllReminders();
  },
};
