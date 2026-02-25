import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class ScheduleException extends Model {
  static table = 'schedule_exceptions';

  static associations = {
    schedules: {type: 'belongs_to' as const, key: 'schedule_id'},
  };

  @field('schedule_id') scheduleId!: string;
  @field('exception_date') exceptionDate!: number; // midnight timestamp
  @field('exception_type') exceptionType!: 'skip' | 'modified';
  @field('new_dtstart') newDtstart!: number | null; // for modified instances
  @field('new_duration') newDuration!: number | null; // for modified instances
  @readonly @date('created_at') createdAt!: Date;
}
