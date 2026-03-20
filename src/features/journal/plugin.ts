/**
 * Journal Plugin Manifest.
 *
 * Provides a daily journal with wiki-style links between pages,
 * full-text search, and backlink tracking.
 */

import {tableSchema} from '@nozbe/watermelondb';
import type {PluginManifest} from '../../plugins/types';
import JournalPage from '../../database/models/JournalPage';
import JournalLink from '../../database/models/JournalLink';
import JournalScreen from './JournalScreen';
import PageEditorScreen from './PageEditorScreen';
import PageListScreen from './PageListScreen';

export const journalPlugin: PluginManifest = {
  id: 'com.lfg.journal',
  name: 'Journal',
  description:
    'Daily notes with wiki-style [[links]] between pages. ' +
    'Includes full-text search, backlink tracking, and a calendar strip for navigation.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F4D3}', // notebook
  isCore: false,

  // ── Database ──────────────────────────────────────────────────────
  tables: [
    tableSchema({
      name: 'journal_pages',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'title', type: 'string'},
        {name: 'title_normalized', type: 'string', isIndexed: true},
        {name: 'content', type: 'string'},
        {name: 'page_type', type: 'string'},
        {name: 'is_pinned', type: 'boolean'},
        {name: 'updated_at', type: 'number'},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'journal_links',
      columns: [
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'source_page_id', type: 'string', isIndexed: true},
        {name: 'target_title_normalized', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
  modelClasses: [JournalPage as any, JournalLink as any],

  // ── Navigation ────────────────────────────────────────────────────
  tabRegistration: {
    label: 'Notes',
    icon: {active: '\u{1F4D3}', inactive: '\u{1F4D3}'},
    order: 40,
    stack: [
      {
        name: 'Journal',
        component: JournalScreen,
        options: {headerShown: false},
      },
      {
        name: 'PageEditor',
        component: PageEditorScreen,
        options: {headerTitle: 'Page'},
      },
      {
        name: 'PageList',
        component: PageListScreen,
        options: {headerTitle: 'All Pages'},
      },
    ],
  },
};
