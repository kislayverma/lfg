# LFG - Architecture & Design Document

LFG is a React Native CLI app for habit tracking and personal journaling. It runs on iOS and Android with a local-first SQLite database, push notifications, native calendar integration, and a built-in wiki-style journal.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [App Initialization & Lifecycle](#3-app-initialization--lifecycle)
4. [Database Layer](#4-database-layer)
5. [State Management](#5-state-management)
6. [Navigation](#6-navigation)
7. [Theme System](#7-theme-system)
8. [Feature Modules](#8-feature-modules)
   - [Calendar & Scheduling](#81-calendar--scheduling)
   - [Activities](#82-activities)
   - [Streaks](#83-streaks)
   - [Journal](#84-journal)
   - [Sharing](#85-sharing)
   - [Auth](#86-auth)
9. [Services](#9-services)
   - [Streak Engine](#91-streak-engine)
   - [Notifications](#92-notifications)
   - [Calendar Sync](#93-calendar-sync)
   - [RRULE Helper](#94-rrule-helper)
   - [Background Tasks](#95-background-tasks)
   - [Celebration Feedback](#96-celebration-feedback)
   - [Deep Links](#97-deep-links)
10. [Custom Hooks](#10-custom-hooks)
11. [Shared Components](#11-shared-components)
12. [Utilities](#12-utilities)
13. [Key Algorithms](#13-key-algorithms)
14. [Data Flow](#14-data-flow)
15. [Extension Points](#15-extension-points)

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native (CLI) | 0.84.0 |
| Language | TypeScript | 5.8.3 |
| UI Runtime | React | 19.2.3 |
| Navigation | React Navigation (bottom-tabs, native-stack) | 7.x |
| Database | WatermelonDB (SQLite) | 0.28.0 |
| State | Zustand | 5.0.11 |
| Persistence | react-native-mmkv | 4.1.2 |
| Notifications | Notifee | 9.1.8 |
| Calendar | react-native-calendar-events | 2.2.0 |
| Background | react-native-background-fetch | 4.3.0 |
| Recurrence | rrule | 2.8.1 |
| Sound | react-native-sound | 0.13.0 |
| Haptics | react-native-haptic-feedback | 2.3.3 |
| Share | react-native-share | 12.2.5 |
| Linting | ESLint | 8.19.0 |
| Formatting | Prettier | 2.8.8 |
| Testing | Jest | 29.6.3 |

---

## 2. Project Structure

```
lfg/
├── App.tsx                          # Root component (providers, lifecycle)
├── index.js                         # Entry point (headless task registration)
├── src/
│   ├── database/                    # WatermelonDB layer
│   │   ├── index.ts                 # Database instance, adapter, exports
│   │   ├── schema.ts                # Table schemas (v6)
│   │   ├── migrations.ts            # Progressive migrations (v2-v6)
│   │   └── models/
│   │       ├── index.ts             # Barrel export of all models
│   │       ├── User.ts
│   │       ├── Activity.ts
│   │       ├── ActivityLog.ts
│   │       ├── Schedule.ts
│   │       ├── ScheduleException.ts
│   │       ├── JournalPage.ts
│   │       └── JournalLink.ts
│   ├── features/                    # Screen-level feature modules
│   │   ├── auth/
│   │   │   ├── SignUpScreen.tsx
│   │   │   └── LoginScreen.tsx
│   │   ├── calendar/
│   │   │   ├── CalendarScreen.tsx
│   │   │   └── ScheduleActivityScreen.tsx
│   │   ├── activities/
│   │   │   ├── ActivitiesScreen.tsx
│   │   │   ├── ActivityDetailScreen.tsx
│   │   │   ├── LogActivityScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── streaks/
│   │   │   ├── StreaksScreen.tsx
│   │   │   └── StreakDetailScreen.tsx
│   │   ├── journal/
│   │   │   ├── JournalScreen.tsx
│   │   │   ├── PageEditorScreen.tsx
│   │   │   ├── PageListScreen.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useJournalPage.ts
│   │   │   ├── components/
│   │   │   │   ├── MarkdownRenderer.tsx
│   │   │   │   ├── CalendarStrip.tsx
│   │   │   │   ├── BacklinksSection.tsx
│   │   │   │   └── JournalSearchBar.tsx
│   │   │   └── utils/
│   │   │       ├── markdownParser.ts
│   │   │       └── linkExtractor.ts
│   │   └── sharing/
│   │       └── ReceiveShareScreen.tsx
│   ├── services/                    # Business logic (platform-agnostic)
│   │   ├── streakEngine.ts
│   │   ├── notifications.ts
│   │   ├── calendarSync.ts
│   │   ├── rruleHelper.ts
│   │   ├── backgroundTasks.ts
│   │   ├── feedback.ts
│   │   └── deepLink.ts
│   ├── hooks/                       # Shared custom hooks
│   │   ├── useActivities.ts
│   │   └── useSchedule.ts
│   ├── stores/                      # Zustand stores
│   │   ├── authStore.ts
│   │   ├── themeStore.ts
│   │   ├── preferencesStore.ts
│   │   └── uiStore.ts
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Full navigator tree + type defs
│   ├── theme/
│   │   ├── index.ts                 # Spacing, radius, typography constants
│   │   ├── types.ts                 # Theme type contract
│   │   ├── ThemeContext.tsx          # React context provider + useTheme
│   │   └── themes/
│   │       ├── neonGlass.ts         # Dark neon (default)
│   │       ├── warmGradient.ts      # Light warm
│   │       └── monoBold.ts          # High-contrast mono
│   ├── components/                  # Shared UI components
│   │   ├── StreakBadge.tsx
│   │   ├── StreakCelebration.tsx
│   │   ├── Toast.tsx
│   │   └── ConfettiOverlay.tsx
│   ├── utils/
│   │   ├── date.ts                  # Date normalization, calendar grid
│   │   └── string.ts               # Name normalization, random colors
│   └── assets/                      # Sounds, images
├── android/                         # Android native project
├── ios/                             # iOS native project (Xcode workspace)
├── __tests__/                       # Jest test files
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
└── jest.config.js
```

---

## 3. App Initialization & Lifecycle

### Entry Point (`index.js`)

Registers three things before the JS bundle loads:

1. **App component** via `AppRegistry.registerComponent`
2. **Notifee background handler** for processing notification actions while the app is killed
3. **BackgroundFetch headless task** for Android background execution

### Root Component (`App.tsx`)

Wraps the app in four nested providers:

```
DatabaseProvider          # WatermelonDB context
  ThemeProvider           # Theme context (reads from themeStore)
    SafeAreaProvider      # Safe area insets
      NavigationContainer # React Navigation with deep linking
        AppNavigator      # Tab + stack navigators
```

On mount, `AppContent` runs these side effects:

| Effect | Purpose |
|---|---|
| `setupNotificationChannels()` | Create Android notification channels |
| `setupIOSCategories()` | Register iOS notification action buttons |
| `preloadSounds()` | Load celebration audio files into memory |
| `subscribeForegroundEvents()` | Listen for notification taps while app is open |
| `configureBackgroundFetch()` | Schedule periodic streak recalculation |
| `recalculateAllStreaks()` | Refresh all streak counts on every foreground |

Global overlays rendered outside the navigator:

- `Toast` -- auto-dismissing message bar
- `ConfettiOverlay` -- particle animation on milestones
- `StreakCelebration` -- full-screen celebration with sound/haptics

---

## 4. Database Layer

### Technology

WatermelonDB with a SQLite adapter. All data is local-first with no remote sync (authentication is device-local). The database uses progressive migrations so existing installs upgrade without data loss.

### Schema (v6)

Seven tables with strategic indexing:

```
users
  ├── phone (indexed)
  ├── name
  └── created_at

activities
  ├── user_id (indexed)
  ├── name
  ├── name_normalized (indexed)
  ├── color, icon
  ├── current_streak, longest_streak
  ├── last_logged_at
  └── created_at

activity_logs
  ├── user_id (indexed)
  ├── activity_id (indexed)
  ├── schedule_id (indexed)
  ├── log_date (indexed)
  ├── log_time
  ├── comment
  └── source ('manual' | 'scheduled')

schedules
  ├── user_id (indexed)
  ├── activity_id (indexed, optional)    -- NULL for ad-hoc schedules
  ├── ad_hoc_name (optional)             -- display name when no linked activity
  ├── rrule                              -- RFC 5545 recurrence string
  ├── dtstart
  ├── duration_minutes, reminder_offset
  ├── until_date
  ├── is_active (indexed)
  ├── native_calendar_event_id
  └── created_at

schedule_exceptions
  ├── schedule_id (indexed)
  ├── exception_date (indexed)           -- midnight timestamp
  ├── exception_type ('skip' | 'modified')
  ├── new_dtstart, new_duration
  └── created_at

journal_pages
  ├── user_id (indexed)
  ├── title
  ├── title_normalized (indexed)
  ├── content                            -- raw markdown
  ├── page_type ('daily' | 'page')
  ├── is_pinned
  ├── updated_at
  └── created_at

journal_links
  ├── user_id (indexed)
  ├── source_page_id (indexed)           -- FK to journal_pages
  ├── target_title_normalized (indexed)  -- referenced page title
  └── created_at
```

### Migration History

| Version | Changes |
|---|---|
| v2 | Added `user_id` to activities, activity_logs, schedules |
| v3 | Created `schedule_exceptions` table |
| v4 | Added performance indices on frequently queried columns |
| v5 | Added `ad_hoc_name` column to schedules |
| v6 | Created `journal_pages` and `journal_links` tables |

### Model Associations

```
User
  has_many -> Activity
  has_many -> Schedule
  has_many -> JournalPage

Activity
  has_many -> ActivityLog
  has_many -> Schedule
  belongs_to -> User

Schedule
  belongs_to -> Activity (optional)
  has_many -> ScheduleException
  has_many -> ActivityLog

JournalPage
  has_many -> JournalLink (as source)
```

### Ad-Hoc Schedules

Schedules can exist without a linked Activity. When `activity_id` is NULL:
- `ad_hoc_name` provides the display name
- The schedule does not appear in Activities or Streaks tabs
- Calendar view shows these with a "Done" dismiss action (not "Mark Done" which logs activity)
- Notifications omit the "Mark Done" action button
- The streak engine skips them entirely

---

## 5. State Management

Four Zustand stores, three persisted to MMKV:

### authStore (persisted)

```typescript
{
  currentUser: User | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  hydrate(): void,         // Load from MMKV on startup
  signup(phone, name): void,
  login(phone): void,
  logout(): void,
}
```

Storage key: `current_user_id` (stores the WatermelonDB record ID).

### themeStore (persisted)

```typescript
{
  themeId: 'neonGlass' | 'warmGradient' | 'monoBold',
  setThemeId(id): void,
}
```

Default: `neonGlass`. Storage key: `selected_theme`.

### preferencesStore (persisted)

```typescript
{
  calendarSyncEnabled: boolean,       // default: true
  notificationsEnabled: boolean,      // default: true
  defaultReminderMinutes: number,     // default: 15
  celebrationNotificationsEnabled: boolean,  // default: true
}
```

Storage keys prefixed with `pref_`.

### uiStore (ephemeral, not persisted)

```typescript
{
  selectedDate: Date,
  currentMonth: number,
  currentYear: number,
  isLogModalVisible: boolean,
  isScheduleModalVisible: boolean,
  toastMessage: string | null,
  confettiVisible: boolean,
  confettiMessage: string | null,
  celebrationVisible: boolean,
  celebrationStreak: number,
}
```

Transient UI state that resets on app restart.

---

## 6. Navigation

### Navigator Tree

```
AppNavigator (conditional root)
├── AuthStack (when !isAuthenticated)
│   ├── SignUp
│   └── Login
│
└── MainNavigator (Tab.Navigator, when isAuthenticated)
    ├── HomeTab
    │   └── HomeStack
    │       ├── Calendar           -- month grid, daily schedule view
    │       ├── LogActivity        -- modal: log a completed activity
    │       ├── ScheduleActivity   -- modal: create recurring schedule
    │       └── ReceiveShare       -- modal: accept shared activity link
    │
    ├── StreaksTab
    │   └── StreaksStack
    │       ├── StreaksList         -- all activities ranked by streak
    │       └── StreakDetail        -- single activity streak timeline
    │
    ├── ActivitiesTab
    │   └── ActivitiesStack
    │       ├── ActivitiesList     -- all activities, search, log
    │       └── ActivityDetail     -- activity detail, logs, schedules
    │
    ├── JournalTab
    │   └── JournalStack
    │       ├── Journal            -- daily journal + calendar strip
    │       ├── PageEditor         -- markdown editor with preview
    │       └── PageList           -- browse/search all pages
    │
    └── SettingsTab
        └── SettingsScreen         -- theme, preferences, account
```

### Type Definitions

Each stack exports its param list for type-safe navigation:

```typescript
AuthStackParamList       = { SignUp, Login }
HomeStackParamList       = { Calendar, LogActivity, ScheduleActivity, ReceiveShare }
StreaksStackParamList     = { StreaksList, StreakDetail }
ActivitiesStackParamList = { ActivitiesList, ActivityDetail }
JournalStackParamList    = { Journal, PageEditor, PageList }
RootTabParamList         = { HomeTab, StreaksTab, ActivitiesTab, JournalTab, SettingsTab }
```

### Tab Bar

Emoji-based icons with opacity toggle and active dot indicator:

| Tab | Icon | Screen |
|---|---|---|
| Home | House | CalendarScreen |
| Streaks | Fire | StreaksScreen |
| Activities | Check | ActivitiesScreen |
| Journal | Notebook | JournalScreen |
| Settings | Gear | SettingsScreen |

### Deep Linking

Configured in `NavigationContainer` with two URL prefixes:

- `lfg://` (custom scheme)
- `https://lfghabits.app` (universal link)

Route: `share` maps to `HomeTab > ReceiveShare` with params `{name, rrule, time, duration}`.

---

## 7. Theme System

### Architecture

Context-based theming with three complete theme implementations.

```
themeStore (Zustand)        -- persists selected theme ID
    ↓
ThemeProvider (Context)     -- resolves ID to theme object
    ↓
useTheme() hook             -- consumed by every screen/component
```

### Theme Contract (`Theme` type)

| Property | Description |
|---|---|
| `colors` | 60+ named colors (primary, accent, semantic, flame, borders, etc.) |
| `shadows` | sm, md, lg, glow, accentGlow (iOS shadow + Android elevation) |
| `gradients` | warmHeader, streakFire, celebration, glass (color arrays) |
| `glassCard` | Glassmorphism card style (background, border, shadow) |
| `confettiColors` | Array of colors for particle effects |
| `getStreakLevel(n)` | Returns emoji, label, color, glowIntensity for streak count |

### Available Themes

| Theme ID | Style | Background |
|---|---|---|
| `neonGlass` | Dark with neon orange/cyan accents, glassmorphic cards | `#0D0D0F` |
| `warmGradient` | Light warm palette | Light |
| `monoBold` | High-contrast monochrome | Variable |

### Layout Constants (shared across themes)

```typescript
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }
radius  = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 }
typography = { hero, title, heading, body, bodyBold, caption, label, stat }
```

### Streak Levels

| Range | Emoji | Label | Color |
|---|---|---|---|
| 0-2 | Seedling | Sprouting | Green |
| 3-6 | Sparkles | Sparking | Gold |
| 7-13 | Fire | Warming Up | Orange |
| 14-29 | Fire x2 | Blazing | Red-orange |
| 30-99 | Fire x3 | On Fire | Red |
| 100+ | Crown | Legendary | Gold |

---

## 8. Feature Modules

### 8.1 Calendar & Scheduling

**Location:** `src/features/calendar/`

#### CalendarScreen

The app's main screen. Displays a month-view calendar grid with:

- **Day cells** showing colored dots for logged activities and scheduled events
- **Bottom sheet** on day tap showing all items for that date
- **Actions per item:**
  - Logged activities: view details
  - Scheduled activities (with linked Activity): "Mark Done" logs the activity and updates streak
  - Ad-hoc scheduled items (no linked Activity): "Done" dismisses via skip
  - All scheduled items: "Skip" creates a schedule exception
- **Navigation:** FAB or header buttons to LogActivity and ScheduleActivity modals

Uses `getCalendarDays(year, month)` to generate a 42-cell grid (6 weeks) and `useSchedulesForDate()` to resolve which schedules have occurrences on each date.

#### ScheduleActivityScreen

Form for creating recurring or one-time scheduled events:

- **Activity selection:** Search existing activities or type a new name
- **Repeats toggle:** Default is "No" (one-time). Toggling "Yes" reveals:
  - Frequency: Daily, Weekly, Monthly, Yearly
  - Interval: Every N periods
  - Day picker: Select specific weekdays (for weekly)
  - End condition: Forever, until date, or after N occurrences
- **Time:** Start time picker
- **Duration:** Minutes input
- **Reminder:** Offset before event (0, 5, 10, 15, 30, 60 minutes)

**On save:**
- Non-repeating (`repeats=false`): Creates an ad-hoc Schedule with `activityId: null` and `adHocName`. RRULE is `FREQ=DAILY;COUNT=1`.
- Repeating (`repeats=true`): Creates or reuses an Activity record, then creates a Schedule linked to it.
- Schedules notifications, creates system alarm (Android), syncs to native calendar if enabled.

### 8.2 Activities

**Location:** `src/features/activities/`

#### ActivitiesScreen

List of all activities for the current user, sorted by `last_logged_at` descending. Features:

- Search bar with prefix matching on `name_normalized`
- Activity cards showing color dot, name, current streak badge, relative time since last log
- Tap to navigate to ActivityDetail
- Empty state when no activities exist

#### ActivityDetailScreen

Single activity view with:

- Streak badge (animated, with level/color)
- Complete log history as a timeline
- Associated schedules list
- Edit activity (name, color)
- Delete activity

#### LogActivityScreen

Modal form to log a completed activity:

- Activity name input with autocomplete suggestions from existing activities
- Date picker (defaults to selected calendar date or today)
- Time picker (optional)
- Comment field (optional)
- On submit: creates Activity if new, creates ActivityLog, updates streak, shows celebration if milestone

#### SettingsScreen

App-wide configuration:

- **Theme selector:** Visual preview of all three themes
- **Notification toggle:** Enable/disable all notifications
- **Calendar sync toggle:** Enable/disable native calendar integration
- **Celebration toggle:** Enable/disable streak celebration popups
- **Reminder time:** 5, 10, 15, 30, or 60 minutes before
- **Recalculate streaks:** Manual trigger for streak recalculation
- **Logout**

### 8.3 Streaks

**Location:** `src/features/streaks/`

#### StreaksScreen

Dashboard showing all activities ranked by streak performance:

- Summary cards: total activities, average streak, longest streak
- Sort toggles: current streak, longest streak, name
- Pull-to-refresh triggers `recalculateAllStreaks()`
- Each card shows StreakBadge, activity name, current/longest streak numbers

#### StreakDetailScreen

Detailed view for a single activity's streak:

- Large animated StreakBadge with level message
- Log history timeline
- Activity metadata

### 8.4 Journal

**Location:** `src/features/journal/`

A standalone wiki-style journaling system with daily entries and bidirectional page linking.

#### JournalScreen

The journal landing screen with four sections:

1. **Search bar** -- Full-text search across all page titles and content via `JournalSearchBar`. Shows an autocomplete dropdown with results grouped by match type (title, body, both). An "All" link provides access to the full `PageListScreen`. Selecting a daily page result switches the calendar strip to that date; selecting a named page opens `PageEditorScreen`.

2. **Calendar strip** -- Horizontal date scroller showing 60 days back and 30 days forward. Dots indicate dates with content. Tapping a date loads that day's journal page.

3. **Quick capture bar** -- Text input for rapid thought capture. On submit, appends a timestamped entry (`HH:mm -- thought`) to the current day's content.

4. **Daily page content** -- Renders the selected day's markdown content using `MarkdownRenderer`. Shows backlinks section below. "Edit" button opens the full `PageEditorScreen`. Content updates reactively when the page is edited externally (e.g. from `PageEditorScreen`) thanks to WatermelonDB record observation in the `useJournalPage` hook.

Date labels show "Today", "Yesterday", or the formatted date.

#### PageEditorScreen

Full-screen markdown editor with two modes:

- **Edit mode:** Monospace `TextInput` with multiline support. Placeholder guides syntax (`**bold**, # headings, [[links]]`). Auto-focuses when content is empty.
- **Preview mode:** Renders content through `MarkdownRenderer`. Shows `BacklinksSection` at the bottom.

Toggle between modes via a header button.

**Auto-save:** Content changes are debounced at 500ms and persisted automatically. `flushSave()` is called on the `beforeRemove` navigation event to guarantee nothing is lost.

**Wiki link navigation:** Tapping a `[[link]]` in preview mode calls `navigation.push('PageEditor', {title, pageType: 'page'})`, creating the target page if it doesn't exist.

#### PageListScreen

Browse and search all named pages (excludes daily pages):

- Search input filters by title (using `Q.like` for prefix matching)
- If search text doesn't match any existing page, a "Create" button appears
- FlatList of pages showing title, content preview (stripped of markdown), last updated date, and pin icon
- Sorted by `updated_at` descending

#### Journal Hooks (`hooks/useJournalPage.ts`)

**`useJournalPage(title, pageType)`**

Core hook for loading and managing journal pages:

1. On mount, queries for an existing page by `(userId, titleNormalized, pageType)`
2. If not found, creates a new empty page
3. Subscribes to the page record via `page.observe()` for reactive updates
4. Returns `{page, content, setContent, isLoading, flushSave}`
5. `setContent` updates local state immediately, then triggers a 500ms debounced save
6. On save, calls `rebuildLinks()` to update the link index

**Reactive observation:** After the initial load, the hook observes the WatermelonDB record so that edits made elsewhere (e.g. editing via `PageEditorScreen` then pressing back to `JournalScreen`) are reflected immediately. An `isEditingRef` flag prevents the observer from overwriting content while the user is actively typing in the same hook instance. The flag is set when `setContent` is called and cleared after the debounced save completes or after `flushSave()`.

**`rebuildLinks(pageId, userId, content)`**

Diff-based link index maintenance:

1. Extract `[[wiki links]]` from content using `extractWikiLinks()`
2. Query existing `journal_links` records for this page
3. Compute sets: `toAdd = new - existing`, `toRemove = existing - new`
4. Batch create/delete link records in a single WatermelonDB writer

**`useBacklinks(titleNormalized)`**

Observable query that returns all pages linking to the given title:

1. Queries `journal_links` where `target_title_normalized` matches
2. Fetches the source `JournalPage` for each link
3. Returns reactive array (auto-updates when links change)

**`useAllPages(searchQuery?)`**

Observable query returning all pages of type `'page'`:

1. Filters by `user_id` and `page_type = 'page'`
2. Optionally filters by `title_normalized LIKE query%`
3. Sorted by `updated_at` descending

**`useSearchPages(rawQuery, limit?)`**

Debounced full-text search across page titles and content:

1. Debounces the raw query by 300ms to avoid querying on every keystroke
2. Executes a single WatermelonDB query using `Q.or()` to match `title_normalized LIKE %query%` OR `content LIKE %query%`
3. Results capped at `limit` (default 20), sorted by `updated_at` descending
4. Each result is a `SearchResult` containing:
   - `page` -- the matched `JournalPage` record
   - `matchType` -- `'title'`, `'content'`, or `'both'`
   - `snippet` -- an ~80-character excerpt around the first content match, with markdown syntax stripped
5. Results are sorted with title matches above content-only matches
6. Returns `{results, isSearching, hasQuery}`

**Performance considerations:** SQLite `LIKE %term%` requires a full table scan since B-tree indexes can't accelerate infix matching. For a personal journal (hundreds to low thousands of pages), this completes in single-digit milliseconds on modern phones. The 300ms debounce prevents unnecessary queries during fast typing. WatermelonDB runs queries on a native thread, keeping the JS/UI thread unblocked. If the page count ever reaches 10,000+, SQLite FTS5 could be added, but is unnecessary at personal-journal scale.

#### Journal Components

**`MarkdownRenderer.tsx`**

Zero-dependency markdown renderer built on the custom tokenizer:

- Parses content with `parseMarkdown()` into token array
- `BlockToken` component renders each block-level token (headings, lists, code blocks, blockquotes, horizontal rules)
- `InlineTokens` component renders inline formatting (bold, italic, strikethrough, code, wiki links, plain text)
- Wiki links rendered as tappable text with primary color, calling `onLinkPress(title)`
- Full theme integration for all text styles

**`CalendarStrip.tsx`**

Horizontal date navigation:

- FlatList with `getItemLayout` for O(1) scroll-to-index
- `DAY_CELL_WIDTH = 52` (visual cell) + `DAY_MARGIN = 2` per side = `DAY_WIDTH = 56` total per item (used in `getItemLayout` offset calculation to prevent scroll drift)
- Generates 91 items: 60 days before today + today + 30 days after
- Each item shows: weekday abbreviation (Mon, Tue...) + date number
- Visual states: selected (primary background), today (primary border), has content (dot below date)
- Auto-scrolls to selected date on mount via `scrollToIndex` with `viewPosition: 0.5` (centers the selected date)

**`BacklinksSection.tsx`**

Shows pages that reference the current page:

- Heading: "Linked mentions"
- Each item: page type icon (calendar for daily, document for page) + title + content preview
- Tappable to navigate to the referencing page
- Returns null when no backlinks exist

**`JournalSearchBar.tsx`**

Inline search bar with autocomplete dropdown:

- Compact input row with magnifying glass icon, text input, clear button, and "All" link to `PageListScreen`
- Uses `useSearchPages` hook for debounced full-text search
- Floating dropdown (absolute positioned, z-index 10, max height 280px) appears when focused with a query
- Each result row shows:
  - Page type icon (calendar for daily pages, document for named pages)
  - Page title (daily dates formatted as readable dates via `formatDailyTitle`)
  - Content snippet for body matches (markdown stripped)
  - Match type badge (`title`, `body`, `title+body`)
- Keyboard behavior: `keyboardShouldPersistTaps="handled"` on the results FlatList so tapping a result works without dismissing the keyboard first
- 150ms blur delay prevents the dropdown from hiding before `onPress` fires on result items

#### Journal Utilities

**`markdownParser.ts`**

Custom zero-dependency markdown tokenizer. No external markdown library is used -- this keeps the bundle small and avoids heavy parsing on every keystroke.

Supported token types:

| Block-level | Inline |
|---|---|
| `h1`, `h2`, `h3` | `bold` (`**` or `__`) |
| `bullet` (`-`, `*`, `+`) | `italic` (`*` or `_`) |
| `numbered` (`1.`) | `strikethrough` (`~~`) |
| `checklist` (`- [ ]`, `- [x]`) | `code` (backtick) |
| `codeBlock` (triple backtick) | `wikiLink` (`[[...]]`) |
| `blockquote` (`>`) | `text` (plain) |
| `hr` (`---`, `___`, `***`) | |
| `newline` | |

Exports:
- `parseMarkdown(content: string): Token[]` -- full document tokenizer
- `parseInline(text: string): Token[]` -- inline-only tokenizer
- `parseBlockLine(line: string): Token` -- single line block classifier

**`linkExtractor.ts`**

- `extractWikiLinks(content: string): string[]` -- Returns deduplicated, normalized titles from all `[[...]]` patterns
- `extractTags(content: string): string[]` -- Returns deduplicated `#tag` values (reserved for future use)

### 8.5 Sharing

**Location:** `src/features/sharing/`

#### ReceiveShareScreen

Deep link target for accepting shared activities. Receives params `{name, rrule, time, duration}` from the URL. Displays activity details with a human-readable recurrence description and an "Add to Calendar" button that creates the activity and schedule.

### 8.6 Auth

**Location:** `src/features/auth/`

Device-local authentication (no server). Users register with phone + name. Login looks up the phone in the local database. Session is persisted in MMKV.

#### SignUpScreen
- Fields: phone, name (both required)
- Creates User record in WatermelonDB
- Stores user ID in MMKV via authStore

#### LoginScreen
- Field: phone
- Looks up user by phone
- Error if not found

---

## 9. Services

### 9.1 Streak Engine

**File:** `src/services/streakEngine.ts`

#### `calculateStreak(activityId, prefetchedSchedules?, prefetchedLogs?)`

Calculates the current streak for a single activity. Two algorithms depending on whether the activity has schedules:

**Scheduled activities:**
1. Expand all active RRULEs to get expected occurrence dates
2. Walk backward from today
3. For each scheduled date, check if a matching ActivityLog exists
4. Count consecutive dates with logs; break on first miss
5. Also tracks longest streak across all time

**Unscheduled activities:**
1. Walk backward from today checking each calendar day
2. Count consecutive days that have at least one ActivityLog
3. Break on first day with no log

#### `recalculateAllStreaks()`

Batch operation that refreshes all streak counts:

1. Load all activities for the current user (1 query)
2. Load all active schedules (1 query)
3. Load all activity logs (1 query)
4. Group schedules and logs by activity ID
5. Calculate streak for each activity using prefetched data
6. Batch update activity records with new streak values
7. Prune schedule exceptions older than 90 days

This is O(3) queries instead of O(2N+1) for N activities.

### 9.2 Notifications

**File:** `src/services/notifications.ts`

Uses Notifee for local push notifications.

#### Channels

| Channel | ID | Importance |
|---|---|---|
| Reminders | `habit-reminders` | HIGH (sound + heads-up) |
| Celebrations | `habit-celebrations` | DEFAULT |

#### `scheduleReminders(schedule)`

1. Resolve display name from activity or `adHocName`
2. Expand RRULE up to 1 year ahead
3. Filter to future occurrences (accounting for reminder offset)
4. Take next 30 occurrences (BATCH_SIZE)
5. For each: create a Notifee trigger notification with timestamp trigger
6. Ad-hoc schedules omit the "Mark Done" action button

#### `cancelRemindersForSchedule(scheduleId)`

Cancels all pending trigger notifications whose ID starts with the schedule ID prefix.

#### `cancelReminderForOccurrence(scheduleId, timestamp)`

Cancels a single pending notification by constructing its exact ID from schedule ID + timestamp.

#### `handleNotificationEvent(event)`

Processes notification actions:

1. "Mark Done" action: creates ActivityLog, updates streak
2. If streak >= 2 and celebrations enabled: shows celebration notification
3. If pending notifications < 10: calls `replenishAllReminders()`

#### `createSystemAlarm(schedule, name)`

Android only. Creates a clock app alarm using `react-native-alarm` for critical reminders that survive notification silencing.

### 9.3 Calendar Sync

**File:** `src/services/calendarSync.ts`

Integrates with the device's native calendar via `react-native-calendar-events`.

#### `getOrCreateLFGCalendar()`

Finds or creates a dedicated "LFG" calendar (orange color) to keep habit events separate from personal calendars.

#### `syncScheduleToCalendar(schedule, name)`

Creates a native calendar event:

1. Request calendar permissions
2. Get or create LFG calendar
3. Parse RRULE to native `RecurrenceRule` format
4. Handle platform differences:
   - iOS: uses DURATION field
   - Android: calculates DTEND from start + duration
5. Set alarm/reminder at the configured offset
6. Returns the native event ID (stored on the Schedule record)

#### `parseRRuleToRecurrence(rrule)`

Converts RFC 5545 RRULE string to the `RecurrenceRule` type expected by the native calendar API. Handles FREQ, INTERVAL, COUNT, and UNTIL parameters.

#### `removeScheduleFromCalendar(eventId)`

Deletes a native calendar event by its stored ID.

### 9.4 RRULE Helper

**File:** `src/services/rruleHelper.ts`

Wraps the `rrule` library for recurrence rule operations.

#### `buildRRule(params)`

Constructs an RFC 5545 RRULE string from user-friendly parameters:

```typescript
buildRRule({
  freq: 'WEEKLY',
  byDay: [0, 2, 4],     // Mon, Wed, Fri
  interval: 1,
  until: '2026-12-31',
})
// => "FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1;UNTIL=20261231T235959Z"
```

#### `expandRRule(rruleString, dtstart, until)`

Parses an RRULE and returns all occurrence dates between `dtstart` and `until`.

#### `describeRRule(rruleString, dtstart)`

Returns a human-readable description like "Every Monday, Wednesday, Friday" or "Daily".

### 9.5 Background Tasks

**File:** `src/services/backgroundTasks.ts`

Uses `react-native-background-fetch` for periodic maintenance.

#### `configureBackgroundFetch()`

1. Initializes background fetch with 15-minute minimum interval
2. Schedules a dedicated nightly task at midnight
3. Each execution runs:
   - `recalculateAllStreaks()` -- refresh all streak counts
   - `replenishAllReminders()` -- top up notification queue

#### `headlessTask(event)`

Android-only handler for when the app is killed but a background task fires. Same logic as foreground task.

### 9.6 Celebration Feedback

**File:** `src/services/feedback.ts`

Multi-sensory celebration on streak milestones.

- **Sound:** Three crowd cheer audio files, randomly selected, 5-second duration with 800ms fade-out
- **Haptics:** iOS `notificationSuccess` + `impactHeavy`; Android `impactHeavy` vibration
- **Preloading:** Sounds are loaded into memory on app start to avoid playback delay

### 9.7 Deep Links

**File:** `src/services/deepLink.ts`

Activity sharing via URL:

```
lfg://share?name=Morning+Run&rrule=FREQ%3DDAILY&time=06%3A00&duration=30
```

- `buildShareLink(payload)` -- encodes params into URL
- `parseShareLink(url)` -- decodes URL back to payload
- `buildShareMessage(payload)` -- generates shareable text with embedded link

---

## 10. Custom Hooks

### `useActivities` (`src/hooks/useActivities.ts`)

| Hook/Function | Description |
|---|---|
| `useActivities()` | Observable query: all activities for current user, sorted by last_logged_at desc |
| `useActivitySearch(query)` | Observable query: activities matching name prefix |
| `logActivity(params)` | Creates activity (if new) + log entry, updates streak, returns `{activityId, streak}` |
| `useLogsForDate(date)` | Observable query: all logs for a specific date |
| `useLogsForActivity(activityId)` | Observable query: all logs for a specific activity |
| `useSchedulesForActivity(activityId)` | Observable query: active schedules for an activity |

### `useSchedule` (`src/hooks/useSchedule.ts`)

| Hook/Function | Description |
|---|---|
| `useSchedulesForDate(dateOrKey)` | Observable: scheduled items for a date, filtering out skipped instances. Expands RRULEs to check occurrence. Returns `Array<{schedule, activityId}>` |
| `skipScheduleInstance(scheduleId, date)` | Creates a skip exception for a single date. Cancels that date's notification. |
| `skipAllFutureInstances(scheduleId, fromDate)` | If from start date: deactivates schedule entirely. Otherwise: sets `untilDate` to day before. Cancels all notifications, removes native calendar event. |
| `createSchedule(params)` | Creates Schedule record. Optionally links to Activity or uses `adHocName`. Schedules notifications, creates alarm, syncs to calendar. |
| `deleteSchedule(scheduleId)` | Deactivates schedule, cancels notifications, removes from calendar. |
| `pruneOldExceptions(daysToKeep)` | Deletes schedule exceptions older than N days (default 90). |

---

## 11. Shared Components

**Location:** `src/components/`

### StreakBadge

Displays a streak count with level-appropriate emoji, color, and optional glow animation.

- Props: `streak`, `size` (`sm` | `md` | `lg`), `showLabel`, `animate`
- Spring bounce-in animation on mount
- Pulsing glow effect for streaks >= 7
- Returns null for streak === 0

### StreakCelebration

Full-screen overlay for streak milestones:

- Animated rocket images flying across screen
- Star field scrolling background
- Floating planets with ring animations
- Confetti particle overlay
- Celebration message text
- Sound + haptic feedback
- Auto-dismisses after 5 seconds or on tap

### Toast

Bottom-anchored auto-dismissing message bar:

- Reads message from `uiStore.toastMessage`
- Fades in, displays for 3 seconds, fades out
- Safe area aware

### ConfettiOverlay

Particle-based confetti animation:

- Configurable: particle count, duration, colors (from theme)
- Physics: gravity, horizontal spread, rotation, opacity fade
- `onComplete` callback when animation ends

---

## 12. Utilities

### `src/utils/date.ts`

| Function | Description |
|---|---|
| `normalizeToMidnight(date)` | Returns new Date set to local midnight |
| `toMidnightTimestamp(date)` | Returns midnight timestamp (ms) |
| `todayMidnight()` | Today at local midnight |
| `formatDateKey(date)` | Formats as `YYYY-MM-DD` string |
| `previousDay(date)` | Yesterday at midnight |
| `relativeTime(timestamp)` | Human-readable relative time ("2h ago", "just now") |
| `getCalendarDays(year, month)` | Returns array of 42 Date objects for calendar grid (6 weeks) |

### `src/utils/string.ts`

| Function | Description |
|---|---|
| `normalizeActivityName(name)` | Lowercase + trim |
| `randomActivityColor()` | Random selection from 12-color palette |

---

## 13. Key Algorithms

### Streak Calculation

```
For scheduled activities:
  1. Collect all active schedules for the activity
  2. Merge RRULE expansions to get all expected dates
  3. Walk backward from today
  4. For each expected date: check if log exists
  5. Increment streak while consecutive; break on miss
  6. Track longest streak separately

For unscheduled activities:
  1. Walk backward from today
  2. Check if any log exists for each calendar day
  3. Increment while consecutive; break on miss
```

### Notification Scheduling

```
1. Parse schedule's RRULE
2. Expand from now to now + 1 year
3. Filter: only future times (adjusted by reminderOffset)
4. Take first 30 occurrences
5. Create Notifee trigger notification for each
6. Background task replenishes when < 10 pending
```

### Journal Full-Text Search

```
1. User types in search bar
2. Raw query is debounced by 300ms
3. Single SQL query: WHERE title_normalized LIKE '%q%' OR content LIKE '%q%'
   - Q.or() combines both conditions in one pass
   - Sorted by updated_at DESC, limited to 20 results
4. For each result, classify match type (title/content/both)
5. For content matches, extract ~80-char snippet around first occurrence
   - Strip markdown syntax from snippet
   - Prepend/append ellipsis if truncated
6. Sort: title matches first, then content-only matches
7. Render as autocomplete dropdown
```

### Journal Link Indexing

```
On content save:
  1. Extract [[wiki links]] from new content  -> Set A
  2. Query existing journal_links for page    -> Set B
  3. toAdd    = A - B  (new links)
  4. toRemove = B - A  (deleted links)
  5. Batch: create records for toAdd, delete records for toRemove
```

### Journal Page Observation

```
Problem: JournalScreen and PageEditorScreen both use useJournalPage
with the same title. Edits in PageEditorScreen were not reflected
when navigating back because the hook only fetched once on mount.

Solution:
  1. After initial fetch/create, subscribe via page.observe()
  2. Observer fires on any record update (including from other screens)
  3. isEditingRef flag prevents observer from overwriting active edits:
     - Set to true when setContent() is called
     - Set to false after debounced save completes or flushSave()
  4. When user navigates back, isEditingRef is false, so observer
     updates content with the latest saved value
```

### Calendar Grid Generation

```
1. Find first day of month
2. Find day-of-week for first day
3. Walk back to previous Sunday/Monday (locale-dependent)
4. Generate 42 consecutive Date objects (6 weeks x 7 days)
5. Covers previous month overflow + current month + next month overflow
```

---

## 14. Data Flow

### Overall Architecture

```
┌──────────────────────────────────────────────────┐
│                    UI Layer                       │
│  Screens (features/) + Components (components/)  │
└────────────────────┬─────────────────────────────┘
                     │ reads/writes
                     ▼
┌──────────────────────────────────────────────────┐
│               Hook Layer                          │
│  useActivities, useSchedule, useJournalPage      │
└────────┬───────────────────────────┬─────────────┘
         │ calls                     │ reads/writes
         ▼                          ▼
┌─────────────────────┐  ┌─────────────────────────┐
│   Service Layer     │  │   Store Layer (Zustand)  │
│ streakEngine        │  │ authStore                │
│ notifications       │  │ themeStore               │
│ calendarSync        │  │ preferencesStore         │
│ rruleHelper         │  │ uiStore                  │
│ backgroundTasks     │  └──────────┬──────────────┘
│ feedback            │             │ persisted to
│ deepLink            │             ▼
└────────┬────────────┘  ┌─────────────────────────┐
         │ reads/writes  │       MMKV Storage       │
         ▼               └─────────────────────────┘
┌──────────────────────────────────────────────────┐
│            Database Layer (WatermelonDB)          │
│  Models -> Schema -> SQLite Adapter -> SQLite DB  │
└──────────────────────────────────────────────────┘
```

### State Management Boundaries

| State Type | Storage | Example |
|---|---|---|
| Persistent domain data | WatermelonDB (SQLite) | Activities, logs, schedules, journal pages |
| Persistent preferences | MMKV (Zustand) | Theme, notification settings, user session |
| Ephemeral UI state | Zustand (memory) | Selected date, modal visibility, toast |
| Component-local state | React useState | Form inputs, edit mode, search text |

### Reactive Data Flow

WatermelonDB's observable queries power real-time UI updates:

```
Database record changes
  → Observable query emits new result set
    → Hook state updates
      → Component re-renders
```

This happens automatically when any writer modifies records that match an active query's conditions.

---

## 15. Extension Points

### Adding a New Theme

1. Create `src/theme/themes/newTheme.ts` implementing the `Theme` type
2. Add the theme ID to the `ThemeId` union type
3. Register in `ThemeContext.tsx`'s `themes` record
4. The settings screen theme picker auto-discovers available themes

### Adding a New Database Table

1. Add `tableSchema` to `src/database/schema.ts`
2. Create model class in `src/database/models/`
3. Add migration step in `src/database/migrations.ts` (increment version)
4. Register model in `src/database/models/index.ts` and `src/database/index.ts`

### Adding a New Feature Module

1. Create directory under `src/features/newFeature/`
2. Add screens, hooks, components, utils as needed
3. Define stack param list in `AppNavigator.tsx`
4. Create stack navigator function
5. Add Tab.Screen to `MainNavigator` (or nest in existing stack)

### Adding a New Service

1. Create file in `src/services/`
2. Export pure functions (no React dependencies)
3. Call from hooks or lifecycle effects
4. If background execution needed, integrate with `backgroundTasks.ts`

### Adding a New Store

1. Create file in `src/stores/`
2. Use `create` from Zustand
3. For persistence: use MMKV `getItem`/`setItem` in store definition
4. Consume in components via the store hook
