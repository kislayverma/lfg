import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class JournalPage extends Model {
  static table = 'journal_pages';

  static associations = {
    journal_links: {
      type: 'has_many' as const,
      foreignKey: 'source_page_id',
    },
  };

  @field('user_id') userId!: string;
  @field('title') title!: string;
  @field('title_normalized') titleNormalized!: string;
  @field('content') content!: string;
  @field('page_type') pageType!: 'daily' | 'page';
  @field('is_pinned') isPinned!: boolean;
  @field('updated_at') updatedAt!: number;
  @readonly @date('created_at') createdAt!: Date;
}
