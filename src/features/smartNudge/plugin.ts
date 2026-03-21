/**
 * Smart Nudge Plugin Manifest.
 *
 * Detects activity patterns from log history and sends gentle
 * push notifications when the user is expected to do an activity
 * but hasn't logged it yet.
 *
 * Runs entirely in the background — no dedicated tab. The user
 * can enable/disable nudges from Settings.
 *
 * Anti-annoyance: exponential backoff, frequency caps (max 3/day),
 * quiet hours (10pm–7am), and positive framing.
 */

import {tableSchema} from '@nozbe/watermelondb';
import type {PluginManifest} from '../../plugins/types';
import type {ActivityLoggedPayload} from '../../plugins/events';
import {ACTIVITY_LOGGED} from '../../plugins/events';
import {detectAllPatterns} from '../../services/patternDetection';
import {
  evaluateAndScheduleNudges,
  cancelAllNudges,
  setupNudgeIOSCategories,
} from '../../services/nudgeScheduler';
import {usePreferencesStore} from '../../stores/preferencesStore';
import DetectedPattern from '../../database/models/DetectedPattern';
import NudgeHistory from '../../database/models/NudgeHistory';

export const smartNudgePlugin: PluginManifest = {
  id: 'com.lfg.smartNudge',
  name: 'Smart Nudges',
  description:
    'Learns your activity patterns and sends gentle reminders ' +
    'when you might forget. Adapts to your habits over time.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F9E0}', // brain
  isCore: false,

  // ── Database ──────────────────────────────────────────────────────
  tables: [
    tableSchema({
      name: 'detected_patterns',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'activity_id', type: 'string', isIndexed: true},
        {name: 'pattern_type', type: 'string'},
        {name: 'pattern_data', type: 'string'},
        {name: 'confidence', type: 'number'},
        {name: 'sample_size', type: 'number'},
        {name: 'last_calculated_at', type: 'number'},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'nudge_history',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'activity_id', type: 'string', isIndexed: true},
        {name: 'nudge_sent_at', type: 'number', isIndexed: true},
        {name: 'outcome', type: 'string'},
        {name: 'notification_id', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
  modelClasses: [DetectedPattern, NudgeHistory],

  // No tabRegistration — this plugin runs in the background only

  // ── Event Subscriptions ─────────────────────────────────────────
  eventSubscriptions: [
    {
      event: ACTIVITY_LOGGED,
      handler: async (_payload: ActivityLoggedPayload) => {
        // When an activity is logged, cancel any pending nudge for it
        // and re-detect patterns with the new data point.
        // This is lightweight and runs fire-and-forget.
        try {
          await detectAllPatterns();
        } catch (err) {
          console.error(
            '[SmartNudgePlugin] Error detecting patterns on activity.logged:',
            err,
          );
        }
      },
    },
  ],

  // ── Lifecycle ───────────────────────────────────────────────────
  onActivate: () => {
    // Set up iOS notification categories for nudge actions
    setupNudgeIOSCategories().catch(err =>
      console.error('[SmartNudgePlugin] Error setting up iOS categories:', err),
    );
  },

  onForeground: async () => {
    if (!usePreferencesStore.getState().smartNudgesEnabled) {
      return;
    }

    // Re-detect patterns and schedule nudges when app comes to foreground
    try {
      await detectAllPatterns();
      await evaluateAndScheduleNudges();
    } catch (err) {
      console.error('[SmartNudgePlugin] onForeground error:', err);
    }
  },

  onBackgroundTask: async () => {
    if (!usePreferencesStore.getState().smartNudgesEnabled) {
      return;
    }

    try {
      await detectAllPatterns();
      await evaluateAndScheduleNudges();
    } catch (err) {
      console.error('[SmartNudgePlugin] onBackgroundTask error:', err);
    }
  },

  onDeactivate: () => {
    // Cancel all pending nudge notifications when plugin is disabled
    cancelAllNudges().catch(err =>
      console.error('[SmartNudgePlugin] Error cancelling nudges:', err),
    );
  },
};
