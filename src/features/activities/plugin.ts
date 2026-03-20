/**
 * Activities Plugin Manifest.
 *
 * Provides the activities list, activity detail, and manual logging.
 * Owns the activities and activity_logs tables.
 */

import {tableSchema} from '@nozbe/watermelondb';
import type {PluginManifest} from '../../plugins/types';
import Activity from '../../database/models/Activity';
import ActivityLog from '../../database/models/ActivityLog';

export const activitiesPlugin: PluginManifest = {
  id: 'com.lfg.activities',
  name: 'Activities',
  description:
    'Create and manage activities, view history, and manually log completions. ' +
    'Core data layer used by scheduling and streaks.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{2705}', // check mark
  isCore: true,

  // ── Database ──────────────────────────────────────────────────────
  tables: [
    tableSchema({
      name: 'activities',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'name_normalized', type: 'string', isIndexed: true},
        {name: 'color', type: 'string'},
        {name: 'icon', type: 'string', isOptional: true},
        {name: 'current_streak', type: 'number'},
        {name: 'longest_streak', type: 'number'},
        {name: 'last_logged_at', type: 'number', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'activity_logs',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'activity_id', type: 'string', isIndexed: true},
        {name: 'log_date', type: 'number', isIndexed: true},
        {name: 'log_time', type: 'string', isOptional: true},
        {name: 'comment', type: 'string', isOptional: true},
        {name: 'source', type: 'string'},
        {name: 'schedule_id', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
  modelClasses: [Activity as any, ActivityLog as any],

  // Navigation is handled via the Settings plugin stack.
  // Activities are accessible from Settings > Manage Activities.
};
