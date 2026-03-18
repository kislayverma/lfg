import {
  schemaMigrations,
  createTable,
  addColumns,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'schedules',
          columns: [
            {name: 'ad_hoc_name', type: 'string', isOptional: true},
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        unsafeExecuteSql(
          'CREATE INDEX IF NOT EXISTS activity_logs_log_date ON activity_logs (log_date);',
        ),
        unsafeExecuteSql(
          'CREATE INDEX IF NOT EXISTS schedule_exceptions_exception_date ON schedule_exceptions (exception_date);',
        ),
        unsafeExecuteSql(
          'CREATE INDEX IF NOT EXISTS schedules_is_active ON schedules (is_active);',
        ),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'schedule_exceptions',
          columns: [
            {name: 'schedule_id', type: 'string', isIndexed: true},
            {name: 'exception_date', type: 'number'},
            {name: 'exception_type', type: 'string'},
            {name: 'new_dtstart', type: 'number', isOptional: true},
            {name: 'new_duration', type: 'number', isOptional: true},
            {name: 'created_at', type: 'number'},
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'users',
          columns: [
            {name: 'phone', type: 'string', isIndexed: true},
            {name: 'name', type: 'string'},
            {name: 'created_at', type: 'number'},
          ],
        }),
        addColumns({
          table: 'activities',
          columns: [{name: 'user_id', type: 'string', isIndexed: true}],
        }),
        addColumns({
          table: 'activity_logs',
          columns: [{name: 'user_id', type: 'string', isIndexed: true}],
        }),
        addColumns({
          table: 'schedules',
          columns: [{name: 'user_id', type: 'string', isIndexed: true}],
        }),
      ],
    },
  ],
});
