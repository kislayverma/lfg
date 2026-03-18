import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 6,
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
        {name: 'activity_id', type: 'string', isOptional: true, isIndexed: true},
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
        {name: 'exception_date', type: 'number', isIndexed: true}, // midnight timestamp of the skipped/modified date
        {name: 'exception_type', type: 'string'}, // 'skip' | 'modified'
        {name: 'new_dtstart', type: 'number', isOptional: true}, // rescheduled start time (for 'modified')
        {name: 'new_duration', type: 'number', isOptional: true}, // rescheduled duration (for 'modified')
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'journal_pages',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'title', type: 'string'},
        {name: 'title_normalized', type: 'string', isIndexed: true},
        {name: 'content', type: 'string'},
        {name: 'page_type', type: 'string'}, // 'daily' | 'page'
        {name: 'is_pinned', type: 'boolean'},
        {name: 'updated_at', type: 'number'},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'journal_links',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'source_page_id', type: 'string', isIndexed: true},
        {name: 'target_title_normalized', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
});
