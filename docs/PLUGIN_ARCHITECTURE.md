# LFG Plugin Architecture

## 1. Overview

This document describes the plugin architecture for the LFG app -- a system that allows the app to be composed of independent, modular subsystems (plugins) that can be enabled or disabled by the user through an in-app marketplace.

### Design Goals

1. **Modularity** -- each feature is a self-contained plugin with declared dependencies
2. **Discoverability** -- users browse available plugins in a marketplace tab
3. **Enable/Disable** -- users install and uninstall plugins without app reinstall
4. **Third-party authoring** -- external developers can write plugins that ship in the app
5. **Zero cross-feature coupling** -- plugins communicate only through events and data providers

### Mobile Platform Constraints

React Native apps cannot dynamically load code at runtime:

- **iOS** forbids downloading and executing code that changes app behavior (App Store Guideline 2.5.2)
- **Android** has no mechanism to dynamically load React Native modules with native access
- **Metro bundler** produces a single JS bundle at build time with no runtime extension point

Therefore, LFG uses a **build-time bundling + runtime activation** model:

| Aspect | WordPress (server) | LFG (mobile) |
|---|---|---|
| Plugin code delivery | Downloaded at runtime | Bundled at build time |
| Installation | Server copies files | Flips an enabled flag |
| Native access | Full (PHP extensions) | Full (React Native modules) |
| Uninstallation | Deletes files | Flips flag, hides UI, stops events |
| Third-party contribution | Upload to marketplace | Pull request, reviewed, bundled in next release |
| User experience | Identical | Identical (browse, install, uninstall) |

All plugin code ships inside the app binary. The marketplace tab shows which plugins are available, and "installing" a plugin enables it by writing a flag to persistent storage. The plugin registry reads these flags at startup and only activates enabled plugins. This gives users the full marketplace experience while staying within mobile platform rules.

---

## 2. Architecture Layers

The plugin system is built in three layers, each building on the previous:

```
Layer 3: Marketplace UI                     (user-facing)
  Browse, enable/disable, plugin settings
         |
Layer 2: Event Bus + Data Providers          (inter-plugin communication)
  Typed events, cross-plugin data access
         |
Layer 1: Plugin Registry + Contracts         (foundation)
  Manifest, lifecycle, dynamic registration
         |
   Existing infrastructure
  Database, theme, navigation, stores
```

---

## 3. Layer 1: Plugin Registry & Contracts

### 3.1 Plugin Manifest

Every plugin (including core features) implements this interface:

```typescript
interface PluginManifest {
  /** Unique reverse-domain identifier */
  id: string;                              // 'com.lfg.journal'

  /** Human-readable name shown in marketplace */
  name: string;                            // 'Journal'

  /** Short description for marketplace listing */
  description: string;

  /** Semver version */
  version: string;                         // '1.0.0'

  /** Plugin author */
  author: string;

  /** Icon emoji for marketplace listing */
  icon: string;                            // notebook emoji

  /** Whether this plugin can be disabled by the user.
   *  Core plugins (auth) are not disableable. */
  isCore: boolean;

  // ── Database ─────────────────────────────────────

  /** WatermelonDB table schemas this plugin owns */
  tables?: TableSchema[];

  /** Migration steps for this plugin's tables */
  migrations?: MigrationStep[];

  /** WatermelonDB model classes for this plugin's tables */
  modelClasses?: ModelClass[];

  // ── Navigation ───────────────────────────────────

  /** Tab registration for bottom tab bar.
   *  Omit if this plugin has no dedicated tab. */
  tabRegistration?: TabRegistration;

  // ── Lifecycle ────────────────────────────────────

  /** Called once when plugin is activated (app start or first enable).
   *  Receives PluginContext for accessing shared services. */
  onActivate?(context: PluginContext): void | (() => void);

  /** Called when plugin is disabled by user.
   *  Should clean up subscriptions but NOT delete data. */
  onDeactivate?(): void;

  /** Called during background fetch.
   *  Return a promise that resolves when background work is done. */
  onBackgroundTask?(): Promise<void>;

  /** Called on app foreground (AppState -> 'active') */
  onForeground?(): Promise<void>;

  // ── Inter-plugin ─────────────────────────────────

  /** Data providers this plugin offers to others */
  provides?: ProviderRegistration[];

  /** Provider keys this plugin requires from others */
  requires?: string[];

  /** Event subscriptions this plugin wants to register */
  eventSubscriptions?: EventSubscription[];
}
```

### 3.2 Tab Registration

```typescript
interface TabRegistration {
  /** Tab label shown below icon */
  label: string;                           // 'Journal'

  /** Tab icon (emoji) */
  icon: { active: string; inactive: string };

  /** Screens in this tab's stack navigator */
  stack: StackScreen[];

  /** Sort order for tab positioning (lower = more left) */
  order: number;
}

interface StackScreen {
  /** Route name */
  name: string;

  /** React component */
  component: React.ComponentType<any>;

  /** React Navigation screen options */
  options?: NativeStackNavigationOptions;
}
```

### 3.3 Plugin Context

The context object passed to `onActivate` provides access to shared services without requiring direct imports:

```typescript
interface PluginContext {
  // ── Auth ──
  getCurrentUser(): User | null;
  onAuthChange(callback: (user: User | null) => void): () => void;

  // ── Database ──
  getDatabase(): Database;

  // ── Theme ──
  getTheme(): Theme;

  // ── UI Feedback ──
  showToast(message: string): void;
  showConfetti(message?: string): void;
  showCelebration(streak: number): void;

  // ── Events ──
  emit(event: string, payload?: any): void;
  on(event: string, handler: EventHandler): () => void;

  // ── Data Providers ──
  getProvider<T>(key: string): T | null;
  registerProvider(key: string, provider: any): void;

  // ── Navigation ──
  navigate(routeName: string, params?: any): void;
}
```

### 3.4 Plugin Registry

```typescript
class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map();
  private enabledFlags: Map<string, boolean>;     // persisted to MMKV

  /** Register a plugin manifest (called at build time in plugins/index.ts) */
  register(manifest: PluginManifest): void;

  /** Get all registered plugins */
  getAll(): PluginManifest[];

  /** Get only enabled plugins */
  getEnabled(): PluginManifest[];

  /** Get plugins that have tab registrations (for building tab bar) */
  getTabPlugins(): PluginManifest[];

  /** Enable a plugin (persist to MMKV, call onActivate) */
  enable(pluginId: string): void;

  /** Disable a plugin (persist to MMKV, call onDeactivate) */
  disable(pluginId: string): void;

  /** Check if a plugin is enabled */
  isEnabled(pluginId: string): boolean;

  /** Get all model classes from enabled plugins (for database init) */
  getAllModelClasses(): ModelClass[];

  /** Get all table schemas from enabled plugins */
  getAllTableSchemas(): TableSchema[];

  /** Get merged migration steps from all plugins */
  getAllMigrations(): MigrationStep[];

  /** Run onBackgroundTask for all enabled plugins */
  runBackgroundTasks(): Promise<void>;

  /** Run onForeground for all enabled plugins */
  runForegroundTasks(): Promise<void>;
}
```

### 3.5 Plugin Discovery (Build Time)

All plugins are registered in a single file that acts as the plugin catalog:

```typescript
// src/plugins/index.ts

import { registry } from './registry';

// Core plugins (cannot be disabled)
import { authPlugin }       from '../features/auth/plugin';
import { settingsPlugin }   from '../features/settings/plugin';

// Feature plugins (user can enable/disable)
import { calendarPlugin }   from '../features/calendar/plugin';
import { activitiesPlugin } from '../features/activities/plugin';
import { streaksPlugin }    from '../features/streaks/plugin';
import { journalPlugin }    from '../features/journal/plugin';
import { sharingPlugin }    from '../features/sharing/plugin';

// Register all plugins
registry.register(authPlugin);
registry.register(settingsPlugin);
registry.register(calendarPlugin);
registry.register(activitiesPlugin);
registry.register(streaksPlugin);
registry.register(journalPlugin);
registry.register(sharingPlugin);

export { registry };
```

A third-party developer adds their plugin by:
1. Creating a directory under `src/features/` or `src/plugins/contrib/`
2. Implementing a `PluginManifest`
3. Adding one import + `registry.register()` line to `src/plugins/index.ts`
4. Submitting a pull request

---

## 4. Layer 2: Event Bus & Data Providers

### 4.1 Event Bus

A typed publish/subscribe system that replaces direct cross-feature function calls.

```typescript
class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /** Emit an event to all subscribers */
  emit(event: string, payload?: any): void;

  /** Subscribe to an event. Returns unsubscribe function. */
  on(event: string, handler: EventHandler): () => void;

  /** Subscribe to an event for one firing only */
  once(event: string, handler: EventHandler): () => void;

  /** Remove all listeners (used on plugin deactivate) */
  removeAllForPlugin(pluginId: string): void;
}

type EventHandler = (payload: any) => void | Promise<void>;
```

### 4.2 Core Event Catalog

Events emitted by core plugins and available for any plugin to subscribe to:

```typescript
// ── Activity Events ─────────────────────────────────────
'activity.created'    → { activityId: string, name: string }
'activity.deleted'    → { activityId: string }
'activity.logged'     → { activityId: string, logDate: number, source: string }

// ── Schedule Events ─────────────────────────────────────
'schedule.created'    → { scheduleId: string, activityId?: string, adHocName?: string }
'schedule.skipped'    → { scheduleId: string, date: number }
'schedule.deactivated'→ { scheduleId: string }

// ── Streak Events ───────────────────────────────────────
'streak.updated'      → { activityId: string, current: number, longest: number }
'streak.milestone'    → { activityId: string, streak: number, name: string }

// ── Journal Events ──────────────────────────────────────
'journal.page.created'→ { pageId: string, title: string, pageType: string }
'journal.page.saved'  → { pageId: string, title: string }
'journal.link.added'  → { sourcePageId: string, targetTitle: string }

// ── App Lifecycle Events ────────────────────────────────
'app.foreground'      → { timestamp: number }
'app.background'      → { timestamp: number }
'auth.login'          → { userId: string }
'auth.logout'         → {}

// ── Plugin Events ───────────────────────────────────────
'plugin.enabled'      → { pluginId: string }
'plugin.disabled'     → { pluginId: string }
```

### 4.3 How Events Replace Direct Coupling

Current coupling and how each is resolved:

```
BEFORE (direct imports):
  notifications.ts
    → imports updateActivityStreak from streakEngine.ts
    → calls it after "Mark Done" notification action

AFTER (event-driven):
  notifications.ts
    → emits 'activity.logged' event after "Mark Done"

  streaksPlugin.onActivate():
    → subscribes to 'activity.logged'
    → calls its own updateActivityStreak()

Neither module imports the other.
```

```
BEFORE:
  useSchedule.ts
    → imports scheduleReminders from notifications.ts
    → imports syncScheduleToCalendar from calendarSync.ts
    → calls both after createSchedule()

AFTER:
  useSchedule.ts (inside calendar plugin)
    → emits 'schedule.created' event after createSchedule()

  notifications service (inside calendar plugin or separate)
    → subscribes to 'schedule.created'
    → calls scheduleReminders()

  calendarSync service (inside calendar plugin)
    → subscribes to 'schedule.created'
    → calls syncScheduleToCalendar()
```

```
BEFORE:
  backgroundTasks.ts
    → imports recalculateAllStreaks from streakEngine.ts
    → imports replenishAllReminders from notifications.ts
    → calls both on background fetch

AFTER:
  backgroundTasks.ts
    → calls registry.runBackgroundTasks()

  streaksPlugin.onBackgroundTask():
    → calls recalculateAllStreaks()

  calendarPlugin.onBackgroundTask():
    → calls replenishAllReminders()
```

### 4.4 Data Providers

For cases where a plugin needs to read data owned by another plugin (not just react to events), a data provider registry is used:

```typescript
interface DataProviderRegistry {
  /** Register a provider function under a key */
  registerProvider(key: string, provider: Function): void;

  /** Get a registered provider */
  getProvider<T extends Function>(key: string): T | null;
}
```

Provider registrations by plugin:

```typescript
// Calendar/Scheduling plugin provides:
'scheduling.getOccurrencesForDate'
  → (dateKey: string) => Array<{ scheduleId, activityId, time, duration }>

'scheduling.getSchedulesForActivity'
  → (activityId: string) => Schedule[]

'scheduling.expandRRule'
  → (rrule: string, start: Date, end: Date) => Date[]

// Activities plugin provides:
'activities.logActivity'
  → (params: LogParams) => Promise<{ activityId, streak }>

'activities.getActivity'
  → (activityId: string) => Promise<Activity | null>

'activities.searchActivities'
  → (query: string) => Promise<Activity[]>

// Auth plugin provides:
'auth.getCurrentUser'
  → () => User | null

// Streaks plugin provides:
'streaks.getStreakForActivity'
  → (activityId: string) => Promise<{ current, longest }>
```

A plugin declares its requirements in the manifest:

```typescript
// Streaks plugin manifest
{
  id: 'com.lfg.streaks',
  requires: [
    'scheduling.getSchedulesForActivity',
    'scheduling.expandRRule',
  ],
  // ...
}
```

The registry validates at startup that all required providers are available from enabled plugins. If a required provider is missing (because the providing plugin is disabled), the dependent plugin is also disabled and the user is informed.

---

## 5. Layer 3: Marketplace UI

### 5.1 Marketplace Tab

A new "Marketplace" section inside the Settings screen (or a dedicated tab) that shows:

```
┌─────────────────────────────────────┐
│  Plugin Marketplace                 │
├─────────────────────────────────────┤
│                                     │
│  ENABLED                            │
│  ┌───────────────────────────────┐  │
│  │ Calendar & Scheduling     [ON]│  │
│  │ Plan and track daily habits   │  │
│  ├───────────────────────────────┤  │
│  │ Activities & Logging      [ON]│  │
│  │ Log activities, track history │  │
│  ├───────────────────────────────┤  │
│  │ Streaks                   [ON]│  │
│  │ Consecutive day tracking      │  │
│  ├───────────────────────────────┤  │
│  │ Journal                   [ON]│  │
│  │ Daily notes with wiki links   │  │
│  └───────────────────────────────┘  │
│                                     │
│  AVAILABLE                          │
│  ┌───────────────────────────────┐  │
│  │ Pomodoro Timer          [GET] │  │
│  │ Focus timer with breaks       │  │
│  ├───────────────────────────────┤  │
│  │ Mood Tracker            [GET] │  │
│  │ Daily mood logging & trends   │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

- **[ON] toggle** disables/enables. Disabling hides the tab, stops event subscriptions, stops background tasks. Data is preserved.
- **[GET] button** enables a plugin that was previously disabled or is new.
- Core plugins (Auth) are not shown or shown without a toggle.

### 5.2 Dependency Resolution UI

When a user tries to disable a plugin that others depend on:

```
  "Streaks requires Scheduling. Disabling Scheduling
   will also disable Streaks. Continue?"

   [Cancel]  [Disable Both]
```

When a user enables a plugin with unmet dependencies:

```
  "Streaks requires Scheduling. Enable Scheduling too?"

   [Cancel]  [Enable Both]
```

### 5.3 Plugin Detail Screen

Tapping a plugin in the marketplace shows:

- Plugin name, icon, author, version
- Full description
- Screenshots (bundled assets)
- What tabs/features it adds
- What data it collects (tables it creates)
- Dependencies (other plugins required)
- Enable/Disable button

---

## 6. Database Strategy

### 6.1 Table Ownership

Each plugin declares the tables it owns. No plugin may write to another plugin's tables -- cross-plugin data access is read-only through data providers.

```
Plugin                Tables Owned
──────────────────    ────────────────────────────
com.lfg.auth          users
com.lfg.activities    activities, activity_logs
com.lfg.calendar      schedules, schedule_exceptions
com.lfg.journal       journal_pages, journal_links
com.lfg.streaks       (none -- reads activities via provider)
com.lfg.sharing       (none -- uses activities + calendar providers)
```

### 6.2 Schema Merging

At database initialization, the registry merges schemas:

```typescript
// database/index.ts
import { registry } from '../plugins';

const allTables = registry.getAllTableSchemas();
const allModels = registry.getAllModelClasses();

const schema = appSchema({
  version: computeSchemaVersion(registry),
  tables: allTables,
});

const database = new Database({
  adapter: new SQLiteAdapter({ schema, migrations }),
  modelClasses: allModels,
});
```

### 6.3 Migration Strategy

Each plugin declares its own migration steps with a plugin-scoped version:

```typescript
// journal/plugin.ts
{
  migrations: [
    {
      pluginVersion: 1,
      steps: [
        createTable({ name: 'journal_pages', columns: [...] }),
        createTable({ name: 'journal_links', columns: [...] }),
      ],
    },
    {
      pluginVersion: 2,
      steps: [
        addColumns({ table: 'journal_pages', columns: [{ name: 'tags', type: 'string' }] }),
      ],
    },
  ],
}
```

The migration runner tracks per-plugin versions in a `_plugin_versions` metadata table:

```
plugin_id          | version
───────────────────┼────────
com.lfg.journal    | 2
com.lfg.activities | 1
com.lfg.calendar   | 3
```

When a plugin is enabled for the first time, its tables are created. When a plugin is updated, its migrations run. When a plugin is disabled, its tables remain (data is preserved). A separate "Delete plugin data" option in the plugin detail screen would drop the tables.

### 6.4 Table Namespacing (Future)

For third-party plugins, table names should be prefixed to prevent collisions:

```
Core plugin table:     journal_pages
Third-party table:     contrib_pomodoro_sessions
```

This is enforced by the registry validating table names on registration.

---

## 7. How a Third-Party Developer Writes a Plugin

### 7.1 Example: Pomodoro Timer Plugin

A developer wants to add a Pomodoro focus timer to LFG. Here's the complete process:

**Step 1: Create the plugin directory**

```
src/plugins/contrib/pomodoro/
├── plugin.ts                    # Plugin manifest
├── PomodoroScreen.tsx           # Main screen
├── PomodoroHistoryScreen.tsx    # History view
├── models/
│   └── PomodoroSession.ts      # Database model
├── hooks/
│   └── usePomodoro.ts           # Timer logic
└── components/
    ├── TimerRing.tsx
    └── SessionCard.tsx
```

**Step 2: Define the model**

```typescript
// models/PomodoroSession.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class PomodoroSession extends Model {
  static table = 'contrib_pomodoro_sessions';

  @field('user_id')      userId!: string;
  @field('activity_id')  activityId!: string | null;
  @field('duration')     duration!: number;
  @field('completed')    completed!: boolean;
  @readonly @date('created_at') createdAt!: Date;
}
```

**Step 3: Write the manifest**

```typescript
// plugin.ts
import type { PluginManifest } from '../../plugins/types';
import { tableSchema } from '@nozbe/watermelondb';
import PomodoroSession from './models/PomodoroSession';
import PomodoroScreen from './PomodoroScreen';
import PomodoroHistoryScreen from './PomodoroHistoryScreen';

export const pomodoroPlugin: PluginManifest = {
  id: 'contrib.pomodoro',
  name: 'Pomodoro Timer',
  description: 'Focus timer with configurable work/break intervals. '
    + 'Optionally links sessions to activities for time tracking.',
  version: '1.0.0',
  author: 'Jane Developer',
  icon: '\u{1F345}',   // tomato
  isCore: false,

  // Database
  tables: [
    tableSchema({
      name: 'contrib_pomodoro_sessions',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'activity_id', type: 'string', isOptional: true },
        { name: 'duration', type: 'number' },
        { name: 'completed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
  migrations: [
    {
      pluginVersion: 1,
      steps: [
        createTable({
          name: 'contrib_pomodoro_sessions',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'activity_id', type: 'string', isOptional: true },
            { name: 'duration', type: 'number' },
            { name: 'completed', type: 'boolean' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
  modelClasses: [PomodoroSession],

  // Navigation -- adds a tab to the bottom bar
  tabRegistration: {
    label: 'Focus',
    icon: { active: '\u{1F345}', inactive: '\u{1F345}' },
    order: 35,   // between Activities (30) and Journal (40)
    stack: [
      { name: 'Pomodoro', component: PomodoroScreen, options: { headerShown: false } },
      { name: 'PomodoroHistory', component: PomodoroHistoryScreen,
        options: { headerTitle: 'Focus History' } },
    ],
  },

  // Optional: link to activities
  requires: ['activities.searchActivities'],

  // Events this plugin listens to
  eventSubscriptions: [
    {
      event: 'app.foreground',
      handler: async () => {
        // Resume timer if one was running
      },
    },
  ],

  // Lifecycle
  onActivate(context) {
    // Subscribe to events, initialize timer state
  },

  onDeactivate() {
    // Stop active timer, clean up
  },
};
```

**Step 4: Register the plugin**

```typescript
// src/plugins/index.ts  (add two lines)
import { pomodoroPlugin } from './contrib/pomodoro/plugin';
registry.register(pomodoroPlugin);
```

**Step 5: Submit a pull request**

The app maintainer reviews the code, merges it, and ships the next release. The Pomodoro plugin appears in the marketplace as "Available" for users to enable.

### 7.2 What the Plugin Author Gets for Free

By implementing `PluginManifest`, the author automatically gets:

- **Tab in the bottom bar** (if tabRegistration is provided)
- **Database tables** created and migrated
- **Background task execution** (if onBackgroundTask is provided)
- **Foreground resume** (if onForeground is provided)
- **Event subscriptions** (app lifecycle, activity events, etc.)
- **Cross-plugin data access** via providers (e.g., search activities to link to pomodoro sessions)
- **Theme integration** via PluginContext.getTheme()
- **Toast/celebration feedback** via PluginContext
- **Enable/disable** via marketplace UI
- **Data persistence** -- disabling doesn't delete data

### 7.3 What the Plugin Author Must NOT Do

- Import from other feature directories directly (use providers/events instead)
- Write to database tables owned by other plugins
- Use unprefixed table names (third-party tables must start with `contrib_`)
- Modify core navigation or theme files
- Call services from other plugins directly

These rules are enforced by:
- Code review at PR time
- ESLint rules restricting cross-plugin imports (configurable)
- Runtime validation in the registry (table name prefixing check)

---

## 8. Plugin Ordering and Tab Layout

Tabs are ordered by the `order` field in `tabRegistration`:

| Plugin | Order | Tab Label |
|---|---|---|
| Calendar | 10 | Home |
| Streaks | 20 | Streaks |
| Activities | 30 | Activities |
| Journal | 40 | Journal |
| Settings | 90 | Settings |

Third-party plugins use intermediate values (e.g., 35 for Pomodoro between Activities and Journal). Settings is always last.

If more than 5 tabs are enabled, React Navigation's bottom tabs automatically collapses extras into a "More" tab. Alternatively, the registry could enforce a maximum of 5 visible tabs with a configuration screen for choosing which tabs to show.

---

## 9. Implementation Phases

### Phase 1: Plugin Registry & Contracts

**Goal:** Every feature is a registered plugin. Tabs are built dynamically from the registry.

1. Create `src/plugins/types.ts` with all interfaces
2. Create `src/plugins/registry.ts` with PluginRegistry class
3. Create `src/plugins/context.ts` with PluginContext implementation
4. Create `src/plugins/index.ts` with all plugin registrations
5. Convert each feature to export a `PluginManifest`:
   - `src/features/journal/plugin.ts` (easiest -- already isolated)
   - `src/features/calendar/plugin.ts`
   - `src/features/activities/plugin.ts`
   - `src/features/streaks/plugin.ts`
   - `src/features/auth/plugin.ts`
   - `src/features/sharing/plugin.ts`
6. Refactor `AppNavigator.tsx` to build tabs from `registry.getTabPlugins()`
7. Refactor `App.tsx` to call `plugin.onActivate()` for each enabled plugin
8. Refactor `index.js` to iterate plugins for background handlers
9. Refactor `database/index.ts` to merge model classes from registry

### Phase 2: Event Bus & Data Providers

**Goal:** Zero direct imports between plugins. All cross-plugin communication via events and providers.

1. Create `src/plugins/eventBus.ts`
2. Create `src/plugins/events.ts` (event name constants + payload types)
3. Create `src/plugins/dataProvider.ts`
4. Wire event bus and data provider registry into PluginContext
5. Refactor services to emit events instead of calling each other:
   - `notifications.ts` emits `activity.logged` instead of calling `updateActivityStreak`
   - `useSchedule.ts` emits `schedule.created` instead of calling `scheduleReminders`/`syncScheduleToCalendar`
   - `backgroundTasks.ts` calls `registry.runBackgroundTasks()` instead of hardcoded calls
6. Register data providers in plugin manifests
7. Add dependency validation at startup (check `requires` against available providers)

### Phase 3: Marketplace UI (Future)

**Goal:** Users can browse, enable, and disable plugins from within the app.

1. Create `pluginStore.ts` (Zustand store persisting enabled/disabled state per plugin)
2. Create `MarketplaceScreen.tsx` showing all registered plugins
3. Create `PluginDetailScreen.tsx` with description, dependencies, enable/disable
4. Add dependency resolution UI (cascade enable/disable)
5. Add "Delete plugin data" option per plugin
6. Handle tab bar rebuilding on enable/disable (may require navigation state reset)

---

## 10. File Structure After Refactor

```
src/
├── plugins/
│   ├── types.ts                 # PluginManifest, PluginContext, etc.
│   ├── registry.ts              # PluginRegistry class
│   ├── context.ts               # PluginContext implementation
│   ├── eventBus.ts              # Typed pub/sub
│   ├── events.ts                # Event name constants + payload types
│   ├── dataProvider.ts          # Cross-plugin data access
│   ├── index.ts                 # Plugin catalog (all registrations)
│   └── contrib/                 # Third-party plugins
│       └── pomodoro/
│           ├── plugin.ts
│           ├── PomodoroScreen.tsx
│           └── ...
├── features/
│   ├── auth/
│   │   ├── plugin.ts            # PluginManifest
│   │   ├── SignUpScreen.tsx
│   │   └── LoginScreen.tsx
│   ├── calendar/
│   │   ├── plugin.ts            # PluginManifest
│   │   ├── CalendarScreen.tsx
│   │   └── ScheduleActivityScreen.tsx
│   ├── activities/
│   │   ├── plugin.ts            # PluginManifest
│   │   ├── ActivitiesScreen.tsx
│   │   └── ...
│   ├── streaks/
│   │   ├── plugin.ts            # PluginManifest
│   │   └── ...
│   ├── journal/
│   │   ├── plugin.ts            # PluginManifest
│   │   └── ...
│   └── sharing/
│       ├── plugin.ts            # PluginManifest
│       └── ...
├── navigation/
│   └── AppNavigator.tsx         # Reads from registry, no hardcoded imports
├── database/
│   ├── index.ts                 # Merges models from registry
│   ├── schema.ts                # Generated from registry
│   └── migrations.ts            # Merged from plugins
└── ...
```

---

## 11. Comparison with Alternatives

### Why not dynamic JS bundles (CodePush-style)?

- Apple forbids it for features that change app behavior
- No access to native modules (notifications, calendar, haptics)
- No type safety at the boundary
- Security risk (executing untrusted code)
- The build-time model gives the same user experience with none of these drawbacks

### Why not WebView-based plugins?

- WebViews can't access React Navigation, WatermelonDB, or native modules
- Performance is significantly worse for UI-heavy features
- Theming would need to be duplicated in CSS
- Could work for very simple "widget" plugins but not for full features like Journal or Pomodoro

### Why not a server-rendered plugin UI?

- Requires internet connectivity (LFG is local-first)
- Latency makes the UX feel non-native
- Same native access limitations as WebView

### Build-time bundling + runtime activation is the industry standard

This is how Obsidian (mobile), Notion, Figma (mobile), and VS Code handle plugins on mobile platforms. The plugin code ships with the app; the user controls what's active.

---

## 12. Security Considerations

### Third-party plugin review

All third-party plugins are reviewed before being merged into the app repository. The review checklist:

- [ ] No network calls to unauthorized endpoints
- [ ] No access to tables outside the plugin's declared `tables`
- [ ] No direct imports from other feature directories
- [ ] Table names prefixed with `contrib_`
- [ ] No modification to core files (navigation, theme, database init)
- [ ] No sensitive data collection beyond declared scope
- [ ] Dependencies declared in `requires` (no hidden coupling)
- [ ] Clean TypeScript compilation
- [ ] Reasonable bundle size impact

### Data isolation

- Plugins can only write to their own tables
- Cross-plugin reads go through data providers (which can enforce access control)
- Disabling a plugin preserves its data but stops all access
- "Delete plugin data" requires explicit user confirmation

### Permissions

A future enhancement could add a permissions system:

```typescript
interface PluginManifest {
  permissions?: ('notifications' | 'calendar' | 'haptics' | 'background')[];
}
```

The marketplace UI would show requested permissions, and the user could grant/deny.
