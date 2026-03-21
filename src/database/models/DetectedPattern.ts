import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

/**
 * Stores detected activity patterns used by the smart nudge system.
 *
 * Each row represents a single pattern observation for an activity,
 * e.g. "user tends to log 'Running' on Mon/Wed/Fri around 7am".
 *
 * Patterns are recalculated periodically in a background task.
 */
export default class DetectedPattern extends Model {
  static table = 'detected_patterns';

  static associations = {
    activities: {type: 'belongs_to' as const, key: 'activity_id'},
  };

  /** Owner user */
  @field('user_id') userId!: string;

  /** The activity this pattern belongs to */
  @field('activity_id') activityId!: string;

  /**
   * Pattern type discriminator.
   *   'day_of_week'  — user logs on certain weekdays
   *   'time_of_day'  — user logs around a certain time
   *   'interval'     — user logs every N days
   */
  @field('pattern_type') patternType!: 'day_of_week' | 'time_of_day' | 'interval';

  /**
   * JSON-encoded pattern data. Structure depends on patternType:
   *
   *   day_of_week:  { days: number[] }           // 0=Sun … 6=Sat
   *   time_of_day:  { hour: number, minute: number }
   *   interval:     { days: number }              // avg days between logs
   */
  @field('pattern_data') patternData!: string;

  /**
   * Confidence score 0–1. Only patterns above a threshold (e.g. 0.65)
   * are used for nudge scheduling.
   */
  @field('confidence') confidence!: number;

  /** Number of historical data points used to compute this pattern */
  @field('sample_size') sampleSize!: number;

  /** When this pattern was last recalculated */
  @field('last_calculated_at') lastCalculatedAt!: number;

  @readonly @date('created_at') createdAt!: Date;
}
