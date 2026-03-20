/**
 * Core type definitions for the LFG plugin system.
 *
 * Every feature in the app implements PluginManifest. The plugin registry
 * reads these manifests at startup to build navigation, merge database
 * schemas, wire lifecycle hooks, and register event subscriptions.
 */

import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';
import type {TableSchema, Model} from '@nozbe/watermelondb';
import type {Database} from '@nozbe/watermelondb';
import type {Theme} from '../theme/types';

// ── Event Bus Types ─────────────────────────────────────────────────

export type EventHandler<T = any> = (payload: T) => void | Promise<void>;

export interface EventSubscription {
  /** Event name to subscribe to */
  event: string;
  /** Handler called when the event fires */
  handler: EventHandler;
}

// ── Data Provider Types ─────────────────────────────────────────────

export interface ProviderRegistration {
  /** Unique key for the provider (e.g. 'activities.logActivity') */
  key: string;
  /** The provider function or object */
  provider: Function;
}

// ── Navigation Types ────────────────────────────────────────────────

export interface StackScreen {
  /** Route name */
  name: string;
  /** React component */
  component: React.ComponentType<any>;
  /** React Navigation screen options */
  options?: NativeStackNavigationOptions;
}

export interface TabRegistration {
  /** Tab label shown below icon */
  label: string;
  /** Tab icon (emoji) */
  icon: {active: string; inactive: string};
  /** Screens in this tab's stack navigator */
  stack: StackScreen[];
  /** Sort order for tab positioning (lower = more left) */
  order: number;
}

// ── Plugin Context ──────────────────────────────────────────────────

/**
 * Shared services passed to plugin onActivate().
 * Provides access to auth, database, theme, UI feedback, events,
 * and data providers without requiring direct imports.
 */
export interface PluginContext {
  // ── Auth ──
  getCurrentUserId(): string | null;

  // ── Database ──
  getDatabase(): Database;

  // ── Theme ──
  getTheme(): Theme;

  // ── UI Feedback ──
  showToast(message: string): void;
  showConfetti(message?: string): void;
  showCelebration(streak: number): void;

  // ── Events ──
  emit<T = any>(event: string, payload?: T): void;
  on<T = any>(event: string, handler: EventHandler<T>): () => void;

  // ── Data Providers ──
  getProvider<T>(key: string): T | null;
  registerProvider(key: string, provider: any): void;
}

// ── Plugin Manifest ─────────────────────────────────────────────────

/**
 * Every feature (core or third-party) implements this interface.
 * The registry reads these manifests to compose the app.
 */
export interface PluginManifest {
  /** Unique reverse-domain identifier (e.g. 'com.lfg.journal') */
  id: string;

  /** Human-readable name shown in marketplace */
  name: string;

  /** Short description for marketplace listing */
  description: string;

  /** Semver version */
  version: string;

  /** Plugin author */
  author: string;

  /** Icon emoji for marketplace listing */
  icon: string;

  /**
   * Whether this plugin can be disabled by the user.
   * Core plugins (auth, settings) are not disableable.
   */
  isCore: boolean;

  // ── Database ─────────────────────────────────────

  /** WatermelonDB table schemas this plugin owns */
  tables?: TableSchema[];

  /** WatermelonDB model classes for this plugin's tables */
  modelClasses?: Array<typeof Model>;

  // ── Navigation ───────────────────────────────────

  /**
   * Tab registration for the bottom tab bar.
   * Omit if this plugin has no dedicated tab.
   */
  tabRegistration?: TabRegistration;

  // ── Lifecycle ────────────────────────────────────

  /**
   * Called once when plugin is activated (app start or first enable).
   * Receives PluginContext for accessing shared services.
   * May return a cleanup function called on deactivate.
   */
  onActivate?(context: PluginContext): void | (() => void);

  /**
   * Called when plugin is disabled by user.
   * Should clean up subscriptions but NOT delete data.
   */
  onDeactivate?(): void;

  /**
   * Called during background fetch.
   * Return a promise that resolves when background work is done.
   */
  onBackgroundTask?(): Promise<void>;

  /**
   * Called on app foreground (AppState -> 'active').
   */
  onForeground?(): Promise<void>;

  // ── Inter-plugin ─────────────────────────────────

  /** Data providers this plugin offers to others */
  provides?: ProviderRegistration[];

  /** Provider keys this plugin requires from others */
  requires?: string[];

  /** Event subscriptions this plugin wants to register */
  eventSubscriptions?: EventSubscription[];
}
