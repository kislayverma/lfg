/**
 * Streaks Plugin Manifest.
 *
 * Provides streak visualization, detail views, and background
 * streak recalculation. Does not own any tables -- reads from
 * activities and activity_logs via direct DB queries.
 *
 * Subscribes to ACTIVITY_LOGGED events to update streaks when
 * activities are logged from notifications or other plugins.
 */

import type {PluginManifest} from '../../plugins/types';
import type {ActivityLoggedPayload} from '../../plugins/events';
import {ACTIVITY_LOGGED} from '../../plugins/events';
import StreaksScreen from './StreaksScreen';
import StreakDetailScreen from './StreakDetailScreen';
import {
  recalculateAllStreaks,
  updateActivityStreak,
} from '../../services/streakEngine';

export const streaksPlugin: PluginManifest = {
  id: 'com.lfg.streaks',
  name: 'Streaks',
  description:
    'Track consecutive-day streaks for your activities. ' +
    'See current and longest streaks at a glance.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F525}', // fire
  isCore: false,

  // No tables -- streaks reads from activities tables

  // ── Navigation ────────────────────────────────────────────────────
  tabRegistration: {
    label: 'Streaks',
    icon: {active: '\u{1F525}', inactive: '\u{1F525}'},
    order: 20,
    stack: [
      {
        name: 'StreaksList',
        component: StreaksScreen,
        options: {headerShown: false},
      },
      {
        name: 'StreakDetail',
        component: StreakDetailScreen,
        options: {headerTitle: 'Streak Detail'},
      },
    ],
  },

  // ── Event Subscriptions ───────────────────────────────────────────
  eventSubscriptions: [
    {
      event: ACTIVITY_LOGGED,
      handler: async (payload: ActivityLoggedPayload) => {
        // When an activity is logged (e.g. from notification "Mark Done"),
        // update the streak for that specific activity.
        try {
          await updateActivityStreak(payload.activityId);
        } catch (err) {
          console.error(
            '[StreaksPlugin] Error updating streak on activity.logged:',
            err,
          );
        }
      },
    },
  ],

  // ── Lifecycle ─────────────────────────────────────────────────────
  onForeground: async () => {
    await recalculateAllStreaks();
  },

  onBackgroundTask: async () => {
    await recalculateAllStreaks();
  },
};
