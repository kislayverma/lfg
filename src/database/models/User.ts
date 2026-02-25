import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('phone') phone!: string;
  @field('name') name!: string;
  @readonly @date('created_at') createdAt!: Date;
}
