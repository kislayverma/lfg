import {Model} from '@nozbe/watermelondb';
import {field, relation, readonly, date} from '@nozbe/watermelondb/decorators';

export default class ActivityLog extends Model {
  static table = 'activity_logs';

  static associations = {
    activities: {type: 'belongs_to' as const, key: 'activity_id'},
    schedules: {type: 'belongs_to' as const, key: 'schedule_id'},
  };

  @field('user_id') userId!: string;
  @field('activity_id') activityId!: string;
  @field('log_date') logDate!: number;
  @field('log_time') logTime!: string | null;
  @field('comment') comment!: string | null;
  @field('source') source!: 'manual' | 'scheduled';
  @field('schedule_id') scheduleId!: string | null;
  @readonly @date('created_at') createdAt!: Date;

  @relation('activities', 'activity_id') activity: any;
  @relation('schedules', 'schedule_id') schedule: any;
}
