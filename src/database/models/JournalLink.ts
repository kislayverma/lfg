import {Model} from '@nozbe/watermelondb';
import {field, readonly, date, relation} from '@nozbe/watermelondb/decorators';

export default class JournalLink extends Model {
  static table = 'journal_links';

  static associations = {
    journal_pages: {
      type: 'belongs_to' as const,
      key: 'source_page_id',
    },
  };

  @field('user_id') userId!: string;
  @field('source_page_id') sourcePageId!: string;
  @field('target_title_normalized') targetTitleNormalized!: string;
  @readonly @date('created_at') createdAt!: Date;

  @relation('journal_pages', 'source_page_id') sourcePage: any;
}
