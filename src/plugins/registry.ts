/**
 * Plugin Registry.
 *
 * Central catalog of all registered plugins. Manages plugin
 * registration, enable/disable state, and provides aggregated
 * access to plugin-contributed database models, navigation tabs,
 * lifecycle hooks, and background tasks.
 *
 * Enable/disable state is persisted to MMKV via the preferencesStore.
 * Core plugins (isCore: true) are always enabled and cannot be disabled.
 */

import type {PluginManifest, PluginContext} from './types';
import type {TableSchema, Model} from '@nozbe/watermelondb';
import {dataProviderRegistry} from './dataProvider';

class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map();
  private enabledOverrides: Map<string, boolean> = new Map();
  private cleanupFns: Map<string, () => void> = new Map();

  // ── Registration ──────────────────────────────────────────────────

  /**
   * Register a plugin manifest.
   * Called at build time in plugins/index.ts.
   */
  register(manifest: PluginManifest): void {
    if (this.plugins.has(manifest.id)) {
      console.warn(
        `[PluginRegistry] duplicate registration for "${manifest.id}". Overwriting.`,
      );
    }
    this.plugins.set(manifest.id, manifest);
  }

  // ── Queries ───────────────────────────────────────────────────────

  /** Get all registered plugins */
  getAll(): PluginManifest[] {
    return [...this.plugins.values()];
  }

  /** Get only enabled plugins */
  getEnabled(): PluginManifest[] {
    return this.getAll().filter(p => this.isEnabled(p.id));
  }

  /** Get enabled plugins that have tab registrations, sorted by order */
  getTabPlugins(): PluginManifest[] {
    return this.getEnabled()
      .filter(p => p.tabRegistration != null)
      .sort((a, b) => a.tabRegistration!.order - b.tabRegistration!.order);
  }

  /** Get a single plugin by ID */
  getPlugin(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  // ── Enable / Disable ─────────────────────────────────────────────

  /**
   * Check if a plugin is enabled.
   * Core plugins are always enabled. Non-core defaults to enabled
   * unless explicitly disabled via setEnabled(id, false).
   */
  isEnabled(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }
    if (plugin.isCore) {
      return true;
    }
    // Default: enabled unless explicitly disabled
    return this.enabledOverrides.get(pluginId) ?? true;
  }

  /**
   * Set the enabled state for a plugin.
   * Core plugins cannot be disabled.
   */
  setEnabled(pluginId: string, enabled: boolean): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      console.warn(`[PluginRegistry] unknown plugin "${pluginId}"`);
      return;
    }
    if (plugin.isCore && !enabled) {
      console.warn(`[PluginRegistry] cannot disable core plugin "${pluginId}"`);
      return;
    }
    this.enabledOverrides.set(pluginId, enabled);
  }

  /**
   * Load persisted enabled/disabled state from storage.
   * Called during app initialization.
   */
  loadEnabledState(state: Record<string, boolean>): void {
    for (const [pluginId, enabled] of Object.entries(state)) {
      this.enabledOverrides.set(pluginId, enabled);
    }
  }

  /**
   * Get the current enabled/disabled overrides for persistence.
   */
  getEnabledState(): Record<string, boolean> {
    const state: Record<string, boolean> = {};
    for (const [pluginId, enabled] of this.enabledOverrides.entries()) {
      state[pluginId] = enabled;
    }
    return state;
  }

  // ── Database Aggregation ──────────────────────────────────────────

  /**
   * Get all table schemas from enabled plugins.
   * Used by database/index.ts to build the merged app schema.
   */
  getAllTableSchemas(): TableSchema[] {
    const tables: TableSchema[] = [];
    for (const plugin of this.getEnabled()) {
      if (plugin.tables) {
        tables.push(...plugin.tables);
      }
    }
    return tables;
  }

  /**
   * Get all model classes from enabled plugins.
   * Used by database/index.ts for the modelClasses array.
   */
  getAllModelClasses(): Array<typeof Model> {
    const models: Array<typeof Model> = [];
    for (const plugin of this.getEnabled()) {
      if (plugin.modelClasses) {
        models.push(...plugin.modelClasses);
      }
    }
    return models;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Activate all enabled plugins.
   * Calls onActivate() and registers event subscriptions and providers.
   */
  activateAll(context: PluginContext): void {
    for (const plugin of this.getEnabled()) {
      this.activatePlugin(plugin, context);
    }
  }

  /**
   * Activate a single plugin.
   */
  private activatePlugin(plugin: PluginManifest, context: PluginContext): void {
    // Register data providers
    if (plugin.provides) {
      for (const {key, provider} of plugin.provides) {
        context.registerProvider(key, provider);
      }
    }

    // Register event subscriptions
    const unsubscribers: Array<() => void> = [];
    if (plugin.eventSubscriptions) {
      for (const {event, handler} of plugin.eventSubscriptions) {
        const unsub = context.on(event, handler);
        unsubscribers.push(unsub);
      }
    }

    // Call onActivate lifecycle hook
    let activateCleanup: (() => void) | undefined;
    if (plugin.onActivate) {
      const result = plugin.onActivate(context);
      if (typeof result === 'function') {
        activateCleanup = result;
      }
    }

    // Store cleanup function for deactivation
    this.cleanupFns.set(plugin.id, () => {
      // Unsubscribe events
      for (const unsub of unsubscribers) {
        unsub();
      }
      // Remove providers
      if (plugin.provides) {
        for (const {key} of plugin.provides) {
          dataProviderRegistry.remove(key);
        }
      }
      // Call plugin cleanup
      activateCleanup?.();
      // Call onDeactivate
      plugin.onDeactivate?.();
    });
  }

  /**
   * Deactivate a plugin by ID.
   */
  deactivatePlugin(pluginId: string): void {
    const cleanup = this.cleanupFns.get(pluginId);
    if (cleanup) {
      cleanup();
      this.cleanupFns.delete(pluginId);
    }
  }

  /**
   * Deactivate all plugins.
   */
  deactivateAll(): void {
    for (const pluginId of this.cleanupFns.keys()) {
      this.deactivatePlugin(pluginId);
    }
  }

  // ── Background & Foreground ───────────────────────────────────────

  /**
   * Run onBackgroundTask for all enabled plugins that define it.
   */
  async runBackgroundTasks(): Promise<void> {
    const tasks = this.getEnabled()
      .filter(p => p.onBackgroundTask != null)
      .map(p => p.onBackgroundTask!());

    await Promise.allSettled(tasks);
  }

  /**
   * Run onForeground for all enabled plugins that define it.
   */
  async runForegroundTasks(): Promise<void> {
    const tasks = this.getEnabled()
      .filter(p => p.onForeground != null)
      .map(p => p.onForeground!());

    await Promise.allSettled(tasks);
  }

  // ── Dependency Validation ─────────────────────────────────────────

  /**
   * Validate that all required providers are available.
   * Returns a list of problems (empty if everything is satisfied).
   */
  validateDependencies(): string[] {
    const availableProviders = new Set<string>();
    for (const plugin of this.getEnabled()) {
      if (plugin.provides) {
        for (const {key} of plugin.provides) {
          availableProviders.add(key);
        }
      }
    }

    const problems: string[] = [];
    for (const plugin of this.getEnabled()) {
      if (plugin.requires) {
        for (const req of plugin.requires) {
          if (!availableProviders.has(req)) {
            problems.push(
              `Plugin "${plugin.name}" (${plugin.id}) requires provider "${req}" which is not available.`,
            );
          }
        }
      }
    }

    return problems;
  }
}

/** Singleton plugin registry */
export const registry = new PluginRegistry();
