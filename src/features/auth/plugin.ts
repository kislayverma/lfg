/**
 * Auth Plugin Manifest.
 *
 * Provides user authentication (sign up, login).
 * Owns the users table. This is a core plugin and cannot be disabled.
 *
 * Note: Auth does not register a tab -- it provides the auth stack
 * navigator which AppNavigator renders when unauthenticated.
 */

import {tableSchema} from '@nozbe/watermelondb';
import type {PluginManifest} from '../../plugins/types';
import User from '../../database/models/User';

export const authPlugin: PluginManifest = {
  id: 'com.lfg.auth',
  name: 'Authentication',
  description: 'User sign-up and login. Core system plugin.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F512}', // lock
  isCore: true,

  // ── Database ──────────────────────────────────────────────────────
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        {name: 'phone', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
  modelClasses: [User as any],

  // No tab registration -- auth screens are handled separately
};
