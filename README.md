# LFG

**Habit Building & Tracking App — Let's F***ing Go!**

Product & Technical Architecture Document — Version 1.0 | February 2026 | Platform: React Native (bare workflow)

---

## 1. Product Overview

### 1.1 Vision

LFG is a local-first mobile application that helps users build and sustain habits through activity logging, calendar scheduling, streak tracking, and social accountability. All data lives on the device with zero backend dependency, giving users full ownership and privacy over their habit data.

### 1.2 Core Concepts

| Concept | Definition |
|---------|------------|
| **Activity** | Any action the user performs: gym, cooking, reading, 8-hour sleep, etc. Activities are identified by their name (case-insensitive match on spelling). The same spelling always refers to the same activity. |
| **Activity Log** | A timestamped record that the user performed an activity on a specific date. Each log can carry an optional comment. |
| **Scheduled Activity** | A calendar appointment for an activity with a specific time. Supports full recurring event configuration identical to Google Calendar (days of week, end date, time, cadence). |
| **Streak** | A consecutive-day counter for an activity. For scheduled activities: the streak holds as long as every scheduled occurrence is completed. For unscheduled activities: the streak holds as long as the activity is done every calendar day. Missing either breaks the streak to zero. |
| **Contact Share** | A scheduled activity shared with a phone contact via the native share sheet, deep link, or QR code. No backend required. |

### 1.3 User Personas

**Primary:** Health-conscious individual (25–45) who wants to build gym, diet, sleep, and reading habits with visual streak motivation.

**Secondary:** Accountability partner who receives shared activity schedules and wants to track alongside a friend.

---

## 2. Feature Specification

### 2.1 Activity Management

#### 2.1.1 Creating & Logging Activities

- The user taps "Log Activity" from the home screen calendar view.
- A searchable dropdown shows all previously created activities (matched by spelling, case-insensitive).
- If the typed name does not match any existing activity, a new activity is created automatically on save.
- Each log entry records: activity name, date, time (optional), and a free-text comment.
- Logging triggers the streak calculation engine (Section 2.3) and may show a celebratory toast.

#### 2.1.2 Activity Autocomplete

The dropdown uses a prefix-match search against the local activity table. Results are sorted by frequency of use (most logged first), then alphabetically. The search is case-insensitive and trims whitespace.

### 2.2 Calendar Scheduling

#### 2.2.1 Creating Scheduled Activities

The scheduling interface mirrors Google Calendar's recurring event creator. The user specifies:

- Activity name (from dropdown or new)
- Start date and time
- End time (duration)
- Recurrence pattern: daily, weekly (select days), monthly (by date or day-of-week), yearly
- Recurrence end: never, after N occurrences, or on a specific date
- Reminder/alarm offset (e.g., 15 minutes before, 1 hour before)

#### 2.2.2 Recurrence Rule (RRULE) Model

Internally, recurrence is stored as an RFC 5545 RRULE string. This is the same standard used by Google Calendar and iCalendar, enabling native calendar sync. Examples:

| Pattern | RRULE |
|---------|-------|
| Every Monday and Wednesday | `FREQ=WEEKLY;BYDAY=MO,WE` |
| Every day until March 31 | `FREQ=DAILY;UNTIL=20260331T235959Z` |
| Every 2 weeks on Friday, 10 times | `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;COUNT=10` |
| First Monday of every month | `FREQ=MONTHLY;BYDAY=1MO` |

#### 2.2.3 Marking Scheduled Activities Done

- Scheduled activities appear on the calendar with a pending status indicator.
- The user taps a scheduled event and marks it "Done", which converts it into an activity log entry.
- Marking done triggers streak calculation and the celebratory toast (if streak >= 2 days).
- A missed scheduled activity (day passes without marking done) breaks the streak for that activity.

### 2.3 Streak Engine

#### 2.3.1 Streak Rules

The streak engine is the heart of LFG. It runs every time an activity is logged or marked done.

| Activity Type | Streak Increments When | Streak Breaks When |
|---------------|----------------------|-------------------|
| **Scheduled** (has recurrence) | Every scheduled occurrence is marked done consecutively from today backward | Any scheduled occurrence is missed (not marked done by end of that calendar day) |
| **Unscheduled** (ad-hoc logs only) | The activity is logged every calendar day consecutively from today backward | Any calendar day is missed (no log entry exists for that day) |
| **Mixed** (has schedule + extra logs) | Treated as scheduled. Extra logs on non-scheduled days are bonus but don't affect streak. | A scheduled occurrence is missed |

#### 2.3.2 Streak Calculation Algorithm

The algorithm works backward from today:

- **Step 1:** Determine if the activity has any active schedule (RRULE). If yes, expand the RRULE to get all scheduled dates from the schedule start date to today.
- **Step 2:** Query all activity log entries for this activity, sorted by date descending.
- **Step 3 (Scheduled):** Walk backward through scheduled dates. For each date, check if a log exists. Count consecutive completions. Stop at the first miss.
- **Step 3 (Unscheduled):** Walk backward from today. For each calendar day, check if a log exists. Count consecutive days. Stop at the first gap.
- **Step 4:** The count is the current streak. Store it in a cached field on the activity record for fast reads.
- **Step 5:** Compare with the stored `longest_streak` and update if current > longest.

#### 2.3.3 Celebratory Toast

When the streak calculation completes and the resulting streak is >= 2, a toast notification appears with the message: "You're on fire! [Activity Name] — [N] day streak!" with a flame animation. This fires both when marking a scheduled activity done and when logging any activity.

### 2.4 Streaks Tab (Bottom Nav)

A dedicated tab in the bottom navigation bar shows all active streaks:

- Sorted by streak length (longest first).
- Each entry shows: activity name, current streak count, longest streak, last completed date.
- Visual streak flame icon whose size scales with streak length.
- Activities with no streak (broken or never started) appear in a "Start a streak" section at the bottom.

### 2.5 Sharing Activities

#### 2.5.1 Share Flow

- User opens a scheduled activity and taps "Share."
- The native contact picker opens (using `react-native-contacts`). User selects a contact.
- The app generates a shareable payload: a deep link URL encoding the activity details (name, schedule RRULE, time).
- The native share sheet opens with the deep link pre-filled. User can send via SMS, WhatsApp, email, etc.
- Recipient taps the link. If LFG is installed, the app opens and offers to add the activity to their calendar. If not installed, the link redirects to the App Store / Play Store.

#### 2.5.2 Deep Link Format

The deep link encodes all activity data in URL parameters so no backend is needed. Format: `lfg://share?name=Gym&rrule=FREQ%3DWEEKLY%3BBYDAY%3DMO%2CWE%2CFR&time=07%3A00&comment=Morning+workout`. The app registers the `lfg://` scheme and also a Universal Link (`https://lfghabits.app/share`) for platforms that support it.

#### 2.5.3 QR Code Alternative

For in-person sharing, the app can generate a QR code containing the same deep link. The recipient scans it with their phone camera or the LFG app's built-in scanner.

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React Native (bare workflow) | Cross-platform, large ecosystem, access to all native modules needed for calendar, contacts, and notifications. |
| Language | TypeScript | Type safety for complex data models (RRULE, streaks). Catches bugs at compile time. |
| Local Database | WatermelonDB (SQLite under the hood) | Best-in-class for offline-first React Native apps. Lazy-loading, observable queries for reactive UI, relational model, runs queries on native thread. |
| Key-Value Store | MMKV | 30x faster than AsyncStorage. Used for user preferences, theme, onboarding state, and cached streak values. |
| Calendar Sync | react-native-calendar-events | Reads/writes native iOS and Android calendars. Pure RN CLI library (no Expo dependency). Supports recurrence rules. |
| Notifications | Notifee (@notifee/react-native) | Reliable background scheduling, calendar-based triggers, works when app is closed. Best alarm support. |
| Contacts | react-native-contacts | Access native phone directory for the share feature. Read-only access. |
| Share Sheet | React Native Share API | Built-in. Opens native share sheet for SMS, email, WhatsApp, etc. |
| Deep Linking | React Navigation deep links | Handles `lfg://` and Universal Links for receiving shared activities. |
| RRULE Parsing | rrule.js | RFC 5545 compliant recurrence rule expansion. Used to generate occurrence dates for streak calculation. |
| Navigation | React Navigation v6+ | Bottom tab navigator + stack navigators. Industry standard. |
| State Management | Zustand + WatermelonDB observables | Zustand for UI state, WatermelonDB's `observe()` for reactive data binding. Minimal boilerplate. |
| QR Codes | react-native-qrcode-svg | Generate QR codes for sharing. |

### 3.2 Project Structure

```
src/
  database/           # WatermelonDB schema, models, migrations
    schema.ts
    models/           # Activity, ActivityLog, Schedule, Streak
    migrations.ts
  features/
    activities/       # Activity CRUD, autocomplete, logging
    calendar/         # Calendar view, scheduling UI, RRULE builder
    streaks/          # Streak tab, streak engine, celebratory toast
    sharing/          # Contact picker, deep link generation, QR
  navigation/         # Bottom tabs, stack navigators, deep link config
  services/
    streakEngine.ts   # Core streak calculation logic
    calendarSync.ts   # Native calendar read/write
    notifications.ts  # Alarm scheduling via Notifee
    rruleHelper.ts    # RRULE expansion and utilities
  components/         # Shared UI: toast, dropdown, calendar cells
  hooks/              # useStreak, useActivities, useSchedule
  stores/             # Zustand stores for UI state
  utils/              # Date helpers, string normalization
```

### 3.3 Data Model

#### 3.3.1 Entity Relationship

The data model has four primary entities. Activity is the root entity. An activity can have many logs (ActivityLog) and many schedules (Schedule). Streak is a computed/cached entity derived from logs and schedules.

#### 3.3.2 WatermelonDB Schema

**Table: `activities`**

| Column | Type | Description |
|--------|------|-------------|
| id | string (UUID) | WatermelonDB auto-generated primary key |
| name | string | Activity name as entered by user (display form) |
| name_normalized | string | Lowercased, trimmed name for matching. Index on this column. |
| color | string | Hex color for calendar display |
| icon | string (nullable) | Optional emoji or icon identifier |
| current_streak | number | Cached current streak count (updated by streak engine) |
| longest_streak | number | All-time longest streak for this activity |
| last_logged_at | number (timestamp) | Timestamp of most recent log. Used for autocomplete sorting. |
| created_at | number (timestamp) | Record creation timestamp |

**Table: `activity_logs`**

| Column | Type | Description |
|--------|------|-------------|
| id | string (UUID) | Primary key |
| activity_id | string (FK) | References activities.id. Indexed. |
| log_date | number (timestamp) | The calendar date of the log (normalized to midnight UTC) |
| log_time | string (nullable) | Optional time in HH:mm format |
| comment | string (nullable) | Free-text user comment |
| source | string | `'manual'` \| `'scheduled'` — whether this came from ad-hoc logging or marking a schedule done |
| schedule_id | string (nullable, FK) | If source is 'scheduled', references schedules.id |
| created_at | number (timestamp) | Record creation timestamp |

**Table: `schedules`**

| Column | Type | Description |
|--------|------|-------------|
| id | string (UUID) | Primary key |
| activity_id | string (FK) | References activities.id. Indexed. |
| rrule | string | RFC 5545 RRULE string (e.g., `FREQ=WEEKLY;BYDAY=MO,WE,FR`) |
| dtstart | number (timestamp) | Start date/time of the first occurrence |
| duration_minutes | number | Duration of the activity in minutes |
| reminder_offset | number | Minutes before the event to trigger alarm (0 = at event time) |
| until_date | number (nullable, timestamp) | Explicit end date (also encoded in RRULE for redundancy) |
| is_active | boolean | Whether the schedule is currently active |
| native_calendar_event_id | string (nullable) | ID of the synced event in the native calendar app |
| created_at | number (timestamp) | Record creation timestamp |

#### 3.3.3 Streak Caching Strategy

The `current_streak` and `longest_streak` fields on the Activity model are denormalized caches. They are updated atomically by the streak engine every time a log is created or a scheduled day passes. This avoids expensive recalculation on every render of the Streaks tab. A nightly background task (via Notifee headless JS) recalculates all streaks to handle missed days.

#### 3.3.4 Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| activities | `name_normalized` | Fast autocomplete lookup |
| activity_logs | `(activity_id, log_date)` | Streak calculation: find logs for an activity sorted by date |
| schedules | `(activity_id, is_active)` | Find active schedules for an activity |

---

## 4. Key Technical Decisions

### 4.1 Local Storage: Why WatermelonDB

The app requires relational data with complex queries (joins between activities, logs, and schedules), reactive UI updates when data changes, and offline-first operation. WatermelonDB is the best fit because:

- It is built on SQLite and runs queries on a native thread, keeping the JS thread free for UI.
- Its observable queries automatically re-render React components when underlying data changes.
- Lazy loading means only visible records are fetched, crucial for users with months of log history.
- MMKV supplements WatermelonDB for simple key-value data (theme preference, onboarding flags, feature flags) where 30x speed over AsyncStorage matters for app startup.

### 4.2 Calendar Sync: Local-Only with react-native-calendar-events

When the user creates a scheduled activity, the app writes a corresponding event to the native device calendar using react-native-calendar-events. The sync is one-way (app → native calendar) to avoid conflicts. The native calendar event ID is stored in the schedule record so the app can update or delete it if the schedule changes.

Key implementation details:

- On first use, the app requests calendar permission and either uses the default calendar or creates a dedicated "LFG" calendar.
- Recurring events are created using the RRULE string directly, which react-native-calendar-events passes through to the native calendar's recurrence engine.
- Changes to a schedule (editing recurrence, deleting) propagate to the native calendar event.
- The app never reads from the native calendar. It is the source of truth; the native calendar is a mirror for visibility.

### 4.3 Alarms and Notifications

Notifee is used to schedule local notifications that act as alarms. When a schedule is created with a `reminder_offset`, the app creates a Notifee trigger notification:

- Trigger type: TIMESTAMP for one-off, or INTERVAL + computed next-fire-time for recurring.
- For recurring alarms, the app computes the next N occurrences using rrule.js and schedules them as individual timestamp triggers (Notifee supports up to 64 pending triggers on Android).
- A background headless JS task (registered with Notifee) fires when the notification is delivered, allowing the app to reschedule the next batch of alarms if needed.
- Notification actions: "Mark Done" button on the notification that triggers the log creation and streak update without opening the app.

### 4.4 Sharing Without a Backend

Since there is no server, sharing relies on encoding all activity data into the share payload itself. Three mechanisms work together:

#### 4.4.1 Deep Link Sharing (Primary)

The app generates a URL like `lfg://share?name=Gym&rrule=FREQ%3DWEEKLY%3BBYDAY%3DMO%2CWE%2CFR&time=07%3A00&duration=60`. This URL is sent via the native Share sheet to any messaging app. The recipient's LFG app handles the deep link and reconstructs the activity and schedule from URL parameters.

#### 4.4.2 Universal Links (Fallback)

For users without LFG installed, a Universal Link (`https://lfghabits.app/share?...`) is also generated. This requires a simple static site hosted on a domain (e.g., GitHub Pages) that redirects to the App Store / Play Store. No backend logic is needed.

#### 4.4.3 QR Code (In-Person)

For face-to-face sharing, the app displays a QR code encoding the deep link URL. The recipient scans it with their phone camera. The QR code is generated client-side using `react-native-qrcode-svg`.

#### 4.4.4 Contact Selection

The `react-native-contacts` library provides read-only access to the device's phone directory. The user searches and selects a contact. The app uses the contact's phone number or email to pre-fill the share sheet's recipient field. No contact data is stored by the app.

---

## 5. Navigation & Screen Design

### 5.1 Bottom Tab Navigation

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | Calendar icon | CalendarScreen | Monthly calendar view showing logged and scheduled activities. Tap a day to see details. FAB to log or schedule. |
| Streaks | Flame icon | StreaksScreen | All streaks sorted by length. Active, broken, and "start a streak" sections. |
| Activities | List icon | ActivitiesScreen | Master list of all activities with stats: total logs, current streak, last logged. |
| Settings | Gear icon | SettingsScreen | Calendar sync toggle, notification preferences, theme, data export. |

### 5.2 Screen Flow Details

#### 5.2.1 CalendarScreen (Home)

- Displays a monthly calendar grid. Days with activity logs show colored dots (one per activity).
- Scheduled activities appear as event blocks below each day.
- Tapping a day opens a DayDetailSheet (bottom sheet) showing all logs and scheduled events for that day.
- Each scheduled event has a "Mark Done" button. Each log shows the comment.
- Floating Action Button (FAB) opens a choice: "Log Activity" or "Schedule Activity."

#### 5.2.2 LogActivityScreen

Modal screen with: a searchable activity dropdown (autocomplete from existing activities or type new), a date picker (defaults to today), an optional time picker, and a comment text input. On save, the streak engine runs and the toast may appear.

#### 5.2.3 ScheduleActivityScreen

Full-screen form mirroring Google Calendar's event creator. Fields: activity dropdown, start date/time, end time, recurrence builder (radio for daily/weekly/monthly/yearly, checkboxes for days of week, interval, end condition), and alarm reminder offset selector. On save, the schedule is written to WatermelonDB, synced to native calendar via react-native-calendar-events, and alarms are registered via Notifee.

#### 5.2.4 StreaksScreen

A FlatList showing streak cards. Each card: activity name, flame icon sized by streak length, current streak number, longest streak, and "last done" relative time. Cards are grouped into Active Streaks (count > 0) and Inactive. Tapping a card navigates to the activity's log history.

#### 5.2.5 ShareActivitySheet

Bottom sheet triggered from a scheduled activity's detail view. Shows a contact search bar, a QR code preview of the deep link, and a "Share via..." button that opens the native share sheet.

---

## 6. Streak Engine — Detailed Design

### 6.1 Trigger Points

The streak engine runs in four scenarios:

| Trigger | What Happens |
|---------|-------------|
| User logs an activity (manual) | Recalculate streak for that activity. Show toast if streak >= 2. |
| User marks scheduled activity done | Create an activity_log with source='scheduled'. Recalculate streak. Show toast if streak >= 2. |
| App comes to foreground | Recalculate all streaks (lightweight: only checks if today's date changed since last check). |
| Nightly background task | Notifee headless JS runs at midnight. Recalculates all streaks to catch missed scheduled activities. |

### 6.2 Pseudocode

```
function calculateStreak(activity):
  schedules = getActiveSchedules(activity.id)
  logs = getLogs(activity.id, sorted_by_date_desc)
  logDateSet = Set(logs.map(l => l.log_date))  // normalized to YYYY-MM-DD

  if schedules.length > 0:
    // SCHEDULED ACTIVITY: check each scheduled date
    allScheduledDates = []
    for schedule in schedules:
      allScheduledDates.push(...expandRRule(schedule.rrule, schedule.dtstart, today))
    scheduledDates = sort(unique(allScheduledDates), desc)

    streak = 0
    for date in scheduledDates:
      if date > today: continue  // future dates don't count
      if logDateSet.has(date):
        streak++
      else:
        break  // first miss breaks streak
    return streak

  else:
    // UNSCHEDULED ACTIVITY: must be done every calendar day
    streak = 0
    currentDate = today
    while logDateSet.has(currentDate):
      streak++
      currentDate = previousDay(currentDate)
    return streak
```

### 6.3 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Activity logged twice on same day | Counts as one day for streak purposes. Second log is recorded but doesn't double-count. |
| Schedule created mid-streak | Only scheduled dates from schedule creation onward are checked. Pre-existing daily logs still count for the unscheduled streak up to the schedule start. |
| Schedule deleted while streak active | Activity reverts to unscheduled streak rules. Existing logs are preserved. |
| Activity logged on non-scheduled day | Recorded as a log but does not affect the scheduled streak positively or negatively. It's a bonus. |
| Multiple schedules for same activity | All scheduled dates are merged. The union of all occurrences must be satisfied. |
| Timezone change | All dates are stored as midnight UTC. The app normalizes to the device's local date on display. |

---

## 7. Notification & Alarm System

### 7.1 Architecture

Alarms are implemented as Notifee local notifications with timestamp triggers. The system has three layers:

- **Scheduling layer:** When a schedule is created/updated, compute the next 30 occurrences and create Notifee timestamp triggers for each.
- **Delivery layer:** Notifee fires the notification at the scheduled time. The notification includes a "Mark Done" action button.
- **Replenishment layer:** A background event handler (Notifee `onBackgroundEvent`) checks remaining scheduled triggers. If fewer than 10 remain, it computes and schedules the next batch.

### 7.2 Notification Channels (Android)

| Channel | Importance | Sound | Purpose |
|---------|-----------|-------|---------|
| habit-reminders | HIGH | Default alarm | Scheduled activity reminders |
| habit-celebrations | DEFAULT | Short chime | Streak celebration toasts |

### 7.3 Mark Done from Notification

When the user taps "Mark Done" on a notification, the Notifee event handler: (1) creates an activity_log entry in WatermelonDB, (2) runs the streak engine, (3) if streak >= 2, fires a follow-up celebration notification on the habit-celebrations channel. This all happens in headless JS without opening the app.

---

## 8. Native Calendar Sync

### 8.1 Sync Strategy

The sync is one-directional: LFG → device calendar. LFG is the source of truth.

### 8.2 Implementation Flow

- On first schedule creation, request calendar permissions via `RNCalendarEvents.requestPermissions()`.
- Check if a "LFG" calendar exists on the device. If not, create one with a distinct color.
- When creating a schedule, call `Calendar.createEventAsync()` with the RRULE, start time, duration, and alarms array.
- Store the returned event ID in the schedule's `native_calendar_event_id` field.
- When updating a schedule, call `Calendar.updateEventAsync()` with the stored event ID.
- When deleting a schedule, call `Calendar.deleteEventAsync()` to remove it from the native calendar.

### 8.3 Platform Considerations

| Platform | Notes |
|----------|-------|
| iOS | Uses EventKit under the hood. RRULE support is excellent. Calendar.app will display the events natively. |
| Android | Uses CalendarProvider. RRULE support varies by vendor but is generally reliable for standard patterns (daily, weekly, monthly). |

---

## 9. Performance Considerations

### 9.1 Streak Engine Performance

RRULE expansion is the most expensive operation. For a daily schedule running for a year, this means expanding 365 dates. Mitigation: cache the expanded dates in memory after first calculation, and only re-expand when the schedule is modified. For the nightly recalculation, batch all activities and run on the native thread via WatermelonDB's batch writer.

### 9.2 Database Performance

- WatermelonDB's lazy loading ensures the Streaks tab only fetches visible streak cards, not all log history.
- Composite index on `(activity_id, log_date)` makes streak queries O(streak_length) rather than O(total_logs).
- Write batching: when the nightly task recalculates all streaks, updates are batched in a single database transaction.

### 9.3 Notification Limits

- Android limits pending notifications to 50 (pre-Android 13) or 64 (Android 13+). The replenishment layer ensures we never exceed this by scheduling only the next 30 occurrences per schedule.
- If the user has many active schedules, the app prioritizes nearest-due notifications and replenishes more frequently.

---

## 10. Data Management

### 10.1 Schema Migrations

WatermelonDB supports incremental schema migrations. Each migration is versioned and runs automatically on app update. The migration file defines `addColumn`, `createTable`, and other operations.

### 10.2 Data Export

The Settings screen offers a "Export Data" button that serializes all activities, logs, and schedules to a JSON file saved to the device's file system via react-native-fs. This serves as a manual backup and can be re-imported on another device.

### 10.3 Data Import

A corresponding "Import Data" button reads a JSON file and upserts records into WatermelonDB. Conflict resolution: if an activity with the same normalized name exists, logs are merged (deduplicated by date). Schedules are compared by RRULE and dtstart.

---

## 11. Required Permissions

| Permission | Platform | When Requested | Fallback if Denied |
|-----------|----------|---------------|-------------------|
| Calendar read/write | iOS + Android | First schedule creation | App works without calendar sync. Events only visible inside LFG. |
| Contacts (read) | iOS + Android | First share attempt | User can manually enter phone number or share via copy-paste. |
| Notifications | iOS + Android | First schedule with reminder | App works but no alarms. User must open app manually. |
| Exact Alarms (SCHEDULE_EXACT_ALARM) | Android 12+ | First reminder setup | Fall back to inexact alarms (may fire up to 10 min late). |
| Camera | iOS + Android | QR code scan | User can use deep link / SMS sharing instead. |

---

## 12. Future Considerations

- **Cloud sync (optional):** Add an opt-in sync layer using WatermelonDB's built-in sync protocol with a lightweight backend (e.g., Supabase or Firebase).
- **Widgets:** iOS WidgetKit and Android App Widgets to show current streaks on the home screen.
- **Apple Watch / Wear OS:** Quick "Mark Done" companion app.
- **Analytics dashboard:** Weekly/monthly charts showing habit consistency over time.
- **Gamification:** Badges for milestones (7-day, 30-day, 100-day streaks).
- **Social feed:** If a backend is added, show a feed of friends' completed habits for accountability.
