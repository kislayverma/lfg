/**
 * Database initialization.
 *
 * Model classes are imported directly here to avoid circular dependency
 * issues with the plugin registry. The plugin manifests also declare
 * their model classes for future use (marketplace enable/disable), but
 * for database init we use direct imports to guarantee correct load order.
 *
 * Schema and migrations are defined in their respective files.
 */

import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schema} from './schema';
import {migrations} from './migrations';
import {
  Activity,
  ActivityLog,
  Schedule,
  ScheduleException,
  User,
  JournalPage,
  JournalLink,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: false,
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Activity,
    ActivityLog,
    Schedule,
    ScheduleException,
    User,
    JournalPage,
    JournalLink,
  ],
});

export {
  Activity,
  ActivityLog,
  Schedule,
  ScheduleException,
  User,
  JournalPage,
  JournalLink,
};
