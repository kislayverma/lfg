import {Model} from '@nozbe/watermelondb';
import {field, relation, readonly, date} from '@nozbe/watermelondb/decorators';

export default class Schedule extends Model {
  static table = 'schedules';

  static associations = {
    activities: {type: 'belongs_to' as const, key: 'activity_id'},
    activity_logs: {type: 'has_many' as const, foreignKey: 'schedule_id'},
  };

  @field('user_id') userId!: string;
  @field('activity_id') activityId!: string;
  @field('rrule') rrule!: string;
  @field('dtstart') dtstart!: number;
  @field('duration_minutes') durationMinutes!: number;
  @field('reminder_offset') reminderOffset!: number;
  @field('until_date') untilDate!: number | null;
  @field('is_active') isActive!: boolean;
  @field('native_calendar_event_id') nativeCalendarEventId!: string | null;
  @readonly @date('created_at') createdAt!: Date;

  @relation('activities', 'activity_id') activity: any;
}
