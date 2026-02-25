import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schema} from './schema';
import {migrations} from './migrations';
import {Activity, ActivityLog, Schedule, ScheduleException, User} from './models';

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
  modelClasses: [Activity, ActivityLog, Schedule, ScheduleException, User],
});

export {Activity, ActivityLog, Schedule, ScheduleException, User};
