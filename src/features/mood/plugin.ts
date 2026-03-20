/**
 * Mood Tracker Plugin Manifest.
 *
 * Provides a mood tracking feature with five intuitive categories
 * (Awesome, Good, Ok, Bad, Awful). Users pick a category, choose a
 * fine-grained mood, and optionally write a journal entry. Each mood
 * is logged as a "Mood Tracking" activity, so streaks are tracked
 * automatically.
 *
 * This plugin does not own any database tables -- it writes to the
 * existing activities and activity_logs tables via the logActivity() hook.
 */

import type {PluginManifest} from '../../plugins/types';
import MoodQuadrantScreen from './MoodQuadrantScreen';
import MoodPickerScreen from './MoodPickerScreen';
import MoodJournalScreen from './MoodJournalScreen';
import MoodHistoryScreen from './MoodHistoryScreen';

export const moodPlugin: PluginManifest = {
  id: 'com.lfg.mood',
  name: 'Mood Tracker',
  description:
    'Track your mood with five simple categories. ' +
    'Pick from 60 fine-grained emotions, add journal notes, ' +
    'and build a mood tracking streak.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{1F60A}', // smiling face
  isCore: false,

  // No tables -- mood logs are stored as activity_logs with
  // the "Mood Tracking" activity name.

  // ── Navigation ────────────────────────────────────────────────────
  tabRegistration: {
    label: 'Mood',
    icon: {active: '\u{1F60A}', inactive: '\u{1F60A}'},
    order: 35, // between Activities (30) and Journal (40)
    stack: [
      {
        name: 'MoodQuadrant',
        component: MoodQuadrantScreen,
        options: {headerShown: false},
      },
      {
        name: 'MoodPicker',
        component: MoodPickerScreen,
        options: {headerTitle: 'How do you feel?'},
      },
      {
        name: 'MoodJournal',
        component: MoodJournalScreen,
        options: {headerTitle: 'Add Note'},
      },
      {
        name: 'MoodHistory',
        component: MoodHistoryScreen,
        options: {headerTitle: 'Mood History'},
      },
    ],
  },
};
