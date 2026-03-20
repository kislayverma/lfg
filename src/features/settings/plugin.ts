/**
 * Settings Plugin Manifest.
 *
 * Provides the Settings tab with theme toggle, user preferences,
 * and account management. Core plugin -- always visible.
 */

import type {PluginManifest} from '../../plugins/types';
import SettingsScreen from '../activities/SettingsScreen';
import ActivitiesScreen from '../activities/ActivitiesScreen';
import ActivityDetailScreen from '../activities/ActivityDetailScreen';

export const settingsPlugin: PluginManifest = {
  id: 'com.lfg.settings',
  name: 'Settings',
  description: 'App settings, theme toggle, and account management.',
  version: '1.0.0',
  author: 'LFG',
  icon: '\u{2699}\u{FE0F}', // gear
  isCore: true,

  // No tables -- settings uses MMKV stores directly

  // ── Navigation ────────────────────────────────────────────────────
  tabRegistration: {
    label: 'Settings',
    icon: {active: '\u{2699}\u{FE0F}', inactive: '\u{2699}\u{FE0F}'},
    order: 90,
    stack: [
      {
        name: 'Settings',
        component: SettingsScreen,
        options: {headerShown: false},
      },
      {
        name: 'ActivitiesList',
        component: ActivitiesScreen,
        options: {headerTitle: 'My Activities'},
      },
      {
        name: 'ActivityDetail',
        component: ActivityDetailScreen,
        options: {headerTitle: 'Activity'},
      },
    ],
  },
};
