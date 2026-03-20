/**
 * Cross-plugin data access registry.
 *
 * Plugins register provider functions under unique keys. Other plugins
 * access these providers through the PluginContext without importing
 * from the providing plugin directly.
 */

class DataProviderRegistry {
  private providers: Map<string, any> = new Map();

  /**
   * Register a provider function under a key.
   * Throws if the key is already registered (prevents silent overwrites).
   */
  register(key: string, provider: any): void {
    if (this.providers.has(key)) {
      console.warn(
        `[DataProviderRegistry] overwriting provider "${key}". ` +
          'This may indicate a duplicate registration.',
      );
    }
    this.providers.set(key, provider);
  }

  /**
   * Get a registered provider. Returns null if not registered.
   */
  get<T>(key: string): T | null {
    return (this.providers.get(key) as T) ?? null;
  }

  /**
   * Check if a provider key is registered.
   */
  has(key: string): boolean {
    return this.providers.has(key);
  }

  /**
   * Remove a provider (e.g. when a plugin is deactivated).
   */
  remove(key: string): void {
    this.providers.delete(key);
  }

  /**
   * Get all registered provider keys.
   */
  keys(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Clear all providers. Used during app reset or testing.
   */
  clear(): void {
    this.providers.clear();
  }
}

/** Singleton data provider registry */
export const dataProviderRegistry = new DataProviderRegistry();
