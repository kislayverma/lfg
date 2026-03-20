/**
 * PluginContext implementation.
 *
 * Bridges between plugins and the app's shared infrastructure
 * (auth, database, theme, UI feedback, events, data providers).
 */

import type {PluginContext} from './types';
import type {Database} from '@nozbe/watermelondb';
import type {Theme} from '../theme/types';
import {eventBus} from './eventBus';
import {dataProviderRegistry} from './dataProvider';

interface ContextDeps {
  getDatabase: () => Database;
  getCurrentUserId: () => string | null;
  getTheme: () => Theme;
  showToast: (message: string) => void;
  showConfetti: (message?: string) => void;
  showCelebration: (streak: number) => void;
}

/**
 * Creates a PluginContext instance with the provided dependencies.
 * Called once during app initialization and passed to each plugin's onActivate.
 */
export function createPluginContext(deps: ContextDeps): PluginContext {
  return {
    // ── Auth ──
    getCurrentUserId: deps.getCurrentUserId,

    // ── Database ──
    getDatabase: deps.getDatabase,

    // ── Theme ──
    getTheme: deps.getTheme,

    // ── UI Feedback ──
    showToast: deps.showToast,
    showConfetti: deps.showConfetti,
    showCelebration: deps.showCelebration,

    // ── Events ──
    emit: (event, payload) => eventBus.emit(event, payload),
    on: (event, handler) => eventBus.on(event, handler),

    // ── Data Providers ──
    getProvider: <T>(key: string) => dataProviderRegistry.get<T>(key),
    registerProvider: (key, provider) =>
      dataProviderRegistry.register(key, provider),
  };
}
