import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

/**
 * Records every nudge notification sent (or suppressed) so the
 * anti-annoyance logic can enforce frequency caps and backoff.
 */
export default class NudgeHistory extends Model {
  static table = 'nudge_history';

  static associations = {
    activities: {type: 'belongs_to' as const, key: 'activity_id'},
  };

  /** Owner user */
  @field('user_id') userId!: string;

  /** The activity this nudge was about */
  @field('activity_id') activityId!: string;

  /** Timestamp when the nudge was sent (or would have been sent) */
  @field('nudge_sent_at') nudgeSentAt!: number;

  /**
   * Outcome of the nudge:
   *   'sent'      — notification was delivered
   *   'acted'     — user tapped "Log it now"
   *   'snoozed'   — user tapped "Snooze"
   *   'dismissed'  — notification was dismissed / expired
   *   'suppressed' — nudge was skipped by anti-annoyance rules
   */
  @field('outcome') outcome!: 'sent' | 'acted' | 'snoozed' | 'dismissed' | 'suppressed';

  /** Notifee notification ID (null if suppressed) */
  @field('notification_id') notificationId!: string | null;

  @readonly @date('created_at') createdAt!: Date;
}
