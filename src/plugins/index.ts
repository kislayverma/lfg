/**
 * Plugin Catalog.
 *
 * All plugins are registered here. This is the single entry point
 * for the plugin system. To add a new plugin:
 *
 * 1. Create a plugin.ts in your feature directory
 * 2. Import it here
 * 3. Call registry.register(yourPlugin)
 *
 * The order of registration does not matter -- tab order is determined
 * by each plugin's tabRegistration.order field.
 */

import {registry} from './registry';

// Core plugins (cannot be disabled)
import {authPlugin} from '../features/auth/plugin';
import {settingsPlugin} from '../features/settings/plugin';
import {calendarPlugin} from '../features/calendar/plugin';
import {activitiesPlugin} from '../features/activities/plugin';

// Feature plugins (user can enable/disable)
import {streaksPlugin} from '../features/streaks/plugin';
import {journalPlugin} from '../features/journal/plugin';
import {moodPlugin} from '../features/mood/plugin';
import {smartNudgePlugin} from '../features/smartNudge/plugin';

// Register all plugins
registry.register(authPlugin);
registry.register(settingsPlugin);
registry.register(calendarPlugin);
registry.register(activitiesPlugin);
registry.register(streaksPlugin);
registry.register(journalPlugin);
registry.register(moodPlugin);
registry.register(smartNudgePlugin);

export {registry};
export {eventBus} from './eventBus';
export {dataProviderRegistry} from './dataProvider';
export {createPluginContext} from './context';
export type {
  PluginManifest,
  PluginContext,
  TabRegistration,
  StackScreen,
  EventHandler,
  EventSubscription,
  ProviderRegistration,
} from './types';
