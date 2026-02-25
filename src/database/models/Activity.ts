import {Model} from '@nozbe/watermelondb';
import {field, date, children, readonly} from '@nozbe/watermelondb/decorators';

export default class Activity extends Model {
  static table = 'activities';

  static associations = {
    activity_logs: {type: 'has_many' as const, foreignKey: 'activity_id'},
    schedules: {type: 'has_many' as const, foreignKey: 'activity_id'},
  };

  @field('user_id') userId!: string;
  @field('name') name!: string;
  @field('name_normalized') nameNormalized!: string;
  @field('color') color!: string;
  @field('icon') icon!: string | null;
  @field('current_streak') currentStreak!: number;
  @field('longest_streak') longestStreak!: number;
  @field('last_logged_at') lastLoggedAt!: number | null;
  @readonly @date('created_at') createdAt!: Date;

  @children('activity_logs') logs: any;
  @children('schedules') schedules: any;
}
