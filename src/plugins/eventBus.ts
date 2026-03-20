/**
 * Typed publish/subscribe event bus for inter-plugin communication.
 *
 * Replaces direct cross-feature function calls. Plugins emit events
 * and subscribe to events from other plugins without import coupling.
 */

import type {EventHandler} from './types';

class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Emit an event to all subscribers.
   * Handlers are called asynchronously (fire-and-forget).
   */
  emit<T = any>(event: string, payload?: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        const result = handler(payload);
        // If handler returns a promise, catch errors silently
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err =>
            console.error(`[EventBus] async handler error for "${event}":`, err),
          );
        }
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler as EventHandler);

    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Subscribe to an event for one firing only.
   */
  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    const wrappedHandler: EventHandler<T> = (payload: T) => {
      unsubscribe();
      return handler(payload);
    };
    const unsubscribe = this.on(event, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Remove all listeners. Used during app reset or testing.
   */
  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus();
