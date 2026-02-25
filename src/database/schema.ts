import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        {name: 'phone', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'created_at', type: 'number'},
      ],
    }),
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
    tableSchema({
      name: 'schedules',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'activity_id', type: 'string', isIndexed: true},
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
        {name: 'exception_date', type: 'number', isIndexed: true}, // midnight timestamp of the skipped/modified date
        {name: 'exception_type', type: 'string'}, // 'skip' | 'modified'
        {name: 'new_dtstart', type: 'number', isOptional: true}, // rescheduled start time (for 'modified')
        {name: 'new_duration', type: 'number', isOptional: true}, // rescheduled duration (for 'modified')
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
});
