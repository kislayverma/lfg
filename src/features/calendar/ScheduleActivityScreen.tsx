import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';

import {database, Activity} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {useActivitySearch} from '../../hooks/useActivities';
import {createSchedule} from '../../hooks/useSchedule';
import {buildRRule, describeRRule} from '../../services/rruleHelper';
import {normalizeActivityName, randomActivityColor} from '../../utils/string';
import {useUIStore} from '../../stores/uiStore';
import {useAuthStore} from '../../stores/authStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {requestNotificationPermission} from '../../services/notifications';
import {requestCalendarPermission} from '../../services/calendarSync';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {HomeStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ScheduleActivity'>;
type Route = RouteProp<HomeStackParamList, 'ScheduleActivity'>;

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type EndType = 'never' | 'count' | 'date';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FREQ_OPTIONS: {label: string; value: Frequency}[] = [
  {label: 'Daily', value: 'DAILY'},
  {label: 'Weekly', value: 'WEEKLY'},
  {label: 'Monthly', value: 'MONTHLY'},
  {label: 'Yearly', value: 'YEARLY'},
];
const DURATION_OPTIONS = [
  {label: '15 min', value: 15},
  {label: '30 min', value: 30},
  {label: '45 min', value: 45},
  {label: '1 hour', value: 60},
  {label: '1.5 hrs', value: 90},
  {label: '2 hrs', value: 120},
];

export default function ScheduleActivityScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const showToast = useUIStore(s => s.showToast);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  const [activityName, setActivityName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchResults = useActivitySearch(activityName);

  const initialDate = route.params?.date
    ? new Date(route.params.date + 'T00:00:00')
    : new Date();
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
  const [interval, setInterval] = useState('1');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [endType, setEndType] = useState<EndType>('never');
  const [occurrenceCount, setOccurrenceCount] = useState('10');
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d;
  });
  const [reminderOffset, setReminderOffset] = useState(15);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectSuggestion = useCallback((name: string) => {
    setActivityName(name);
    setShowSuggestions(false);
  }, []);

  const toggleDay = useCallback(
    (dayIndex: number) => {
      Keyboard.dismiss();
      setSelectedDays(prev =>
        prev.includes(dayIndex)
          ? prev.filter(d => d !== dayIndex)
          : [...prev, dayIndex].sort(),
      );
    },
    [],
  );

  const adjustStartDate = useCallback(
    (days: number) => {
      Keyboard.dismiss();
      const d = new Date(startDate);
      d.setDate(d.getDate() + days);
      setStartDate(d);
    },
    [startDate],
  );

  const adjustEndDate = useCallback(
    (days: number) => {
      Keyboard.dismiss();
      const d = new Date(endDate);
      d.setDate(d.getDate() + days);
      setEndDate(d);
    },
    [endDate],
  );

  const rruleString = repeats
    ? buildRRule({
        freq: frequency,
        interval: parseInt(interval, 10) || 1,
        byDay: frequency === 'WEEKLY' && selectedDays.length > 0 ? selectedDays : undefined,
        count: endType === 'count' ? parseInt(occurrenceCount, 10) || 10 : undefined,
        until: endType === 'date' ? endDate : undefined,
      })
    : buildRRule({freq: 'DAILY', count: 1});

  const rruleDescription = repeats
    ? describeRRule(rruleString, startDate)
    : 'One-time event (does not repeat)';

  const handleSave = useCallback(async () => {
    const trimmed = activityName.trim();
    if (!trimmed) {
      return;
    }

    if (!userId) {
      return;
    }

    setIsSaving(true);
    try {
      const [hours, mins] = startTime.split(':').map(Number);
      const dtstart = new Date(startDate);
      dtstart.setHours(hours || 9, mins || 0, 0, 0);

      // Request permissions upfront before creating the schedule,
      // so native permission dialogs don't interfere with navigation.
      const prefs = usePreferencesStore.getState();
      if (reminderOffset > 0 && prefs.notificationsEnabled) {
        await requestNotificationPermission();
      }
      if (prefs.calendarSyncEnabled) {
        await requestCalendarPermission();
      }

      if (repeats) {
        // Recurring schedule → create or reuse an Activity record
        const activitiesCollection = database.get<Activity>('activities');
        const normalized = normalizeActivityName(trimmed);
        const existing = await activitiesCollection
          .query(
            Q.where('user_id', userId),
            Q.where('name_normalized', normalized),
          )
          .fetch();

        let activityId: string;
        if (existing.length > 0) {
          activityId = existing[0].id;
        } else {
          let newActivity: Activity;
          await database.write(async () => {
            newActivity = await activitiesCollection.create(a => {
              a.userId = userId;
              a.name = trimmed;
              a.nameNormalized = normalized;
              a.color = randomActivityColor();
              a.icon = null;
              a.currentStreak = 0;
              a.longestStreak = 0;
              a.lastLoggedAt = null;
            });
          });
          activityId = newActivity!.id;
        }

        await createSchedule({
          activityId,
          rrule: rruleString,
          dtstart,
          durationMinutes,
          reminderOffset,
          untilDate: endType === 'date' ? endDate : undefined,
        });
      } else {
        // One-time ad-hoc schedule → no Activity record
        await createSchedule({
          adHocName: trimmed,
          rrule: rruleString,
          dtstart,
          durationMinutes,
          reminderOffset,
        });
      }

      showToast(
        repeats
          ? `${trimmed} scheduled! Consistency starts now.`
          : `${trimmed} added to your calendar.`,
      );
      navigation.goBack();
    } catch (error) {
      console.error('Error creating schedule:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    activityName,
    userId,
    repeats,
    startDate,
    startTime,
    durationMinutes,
    rruleString,
    reminderOffset,
    endType,
    endDate,
    showToast,
    navigation,
  ]);

  const startDateLabel = startDate.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const endDateLabel = endDate.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScreenWrapper keyboard edges={[]} bgColor={theme.colors.bgLight}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: Math.max(40, insets.bottom + 16)}]}
        keyboardShouldPersistTaps="handled">
        {/* Activity name */}
        <Text style={styles.label}>What habit are you building?</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Meditation, Workout..."
            placeholderTextColor={theme.colors.textMuted}
            value={activityName}
            onChangeText={text => {
              setActivityName(text);
              setShowSuggestions(text.trim().length > 0);
            }}
            onFocus={() => {
              if (activityName.trim().length > 0) {
                setShowSuggestions(true);
              }
            }}
            autoFocus
          />
          {showSuggestions && searchResults.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {searchResults.slice(0, 5).map(activity => (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(activity.name)}>
                  <View
                    style={[
                      styles.suggestionDot,
                      {backgroundColor: activity.color},
                    ]}
                  />
                  <Text style={styles.suggestionText}>{activity.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Start date */}
        <Text style={styles.label}>Start date</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => adjustStartDate(-1)}>
            <Text style={styles.dateArrowText}>{'\u{2039}'}</Text>
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>{startDateLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => adjustStartDate(1)}>
            <Text style={styles.dateArrowText}>{'\u{203A}'}</Text>
          </TouchableOpacity>
        </View>

        {/* Start time */}
        <Text style={styles.label}>Start time</Text>
        <TextInput
          style={styles.input}
          placeholder="09:00"
          placeholderTextColor={theme.colors.textMuted}
          value={startTime}
          onChangeText={setStartTime}
          keyboardType="numbers-and-punctuation"
        />

        {/* Duration */}
        <Text style={styles.label}>How long?</Text>
        <View style={styles.chipRow}>
          {DURATION_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                durationMinutes === opt.value && styles.chipSelected,
              ]}
              onPress={() => { Keyboard.dismiss(); setDurationMinutes(opt.value); }}>
              <Text
                style={[
                  styles.chipText,
                  durationMinutes === opt.value && styles.chipTextSelected,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Repeats toggle */}
        <Text style={styles.label}>Repeats</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !repeats && styles.chipSelected]}
            onPress={() => { Keyboard.dismiss(); setRepeats(false); }}>
            <Text style={[styles.chipText, !repeats && styles.chipTextSelected]}>
              No
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, repeats && styles.chipSelected]}
            onPress={() => { Keyboard.dismiss(); setRepeats(true); }}>
            <Text style={[styles.chipText, repeats && styles.chipTextSelected]}>
              Yes
            </Text>
          </TouchableOpacity>
        </View>

        {repeats && (
          <>
            {/* Recurrence frequency */}
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chipRow}>
              {FREQ_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    frequency === opt.value && styles.chipSelected,
                  ]}
                  onPress={() => { Keyboard.dismiss(); setFrequency(opt.value); }}>
                  <Text
                    style={[
                      styles.chipText,
                      frequency === opt.value && styles.chipTextSelected,
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interval */}
            <Text style={styles.label}>Every</Text>
            <View style={styles.intervalRow}>
              <TextInput
                style={[styles.input, styles.intervalInput]}
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.intervalSuffix}>
                {frequency === 'DAILY'
                  ? 'day(s)'
                  : frequency === 'WEEKLY'
                    ? 'week(s)'
                    : frequency === 'MONTHLY'
                      ? 'month(s)'
                      : 'year(s)'}
              </Text>
            </View>

            {/* Day-of-week selector (for weekly) */}
            {frequency === 'WEEKLY' && (
              <>
                <Text style={styles.label}>On these days</Text>
                <View style={styles.chipRow}>
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dayChip,
                        selectedDays.includes(idx) && styles.dayChipSelected,
                      ]}
                      onPress={() => toggleDay(idx)}>
                      <Text
                        style={[
                          styles.dayChipText,
                          selectedDays.includes(idx) && styles.dayChipTextSelected,
                        ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* End condition */}
            <Text style={styles.label}>Ends</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, endType === 'never' && styles.chipSelected]}
                onPress={() => { Keyboard.dismiss(); setEndType('never'); }}>
                <Text
                  style={[
                    styles.chipText,
                    endType === 'never' && styles.chipTextSelected,
                  ]}>
                  Never
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, endType === 'count' && styles.chipSelected]}
                onPress={() => { Keyboard.dismiss(); setEndType('count'); }}>
                <Text
                  style={[
                    styles.chipText,
                    endType === 'count' && styles.chipTextSelected,
                  ]}>
                  After
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, endType === 'date' && styles.chipSelected]}
                onPress={() => { Keyboard.dismiss(); setEndType('date'); }}>
                <Text
                  style={[
                    styles.chipText,
                    endType === 'date' && styles.chipTextSelected,
                  ]}>
                  On Date
                </Text>
              </TouchableOpacity>
            </View>

            {endType === 'count' && (
              <View style={styles.intervalRow}>
                <TextInput
                  style={[styles.input, styles.intervalInput]}
                  value={occurrenceCount}
                  onChangeText={setOccurrenceCount}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.intervalSuffix}>occurrences</Text>
              </View>
            )}

            {endType === 'date' && (
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateArrow}
                  onPress={() => adjustEndDate(-7)}>
                  <Text style={styles.dateArrowText}>{'\u{2039}'}</Text>
                </TouchableOpacity>
                <View style={styles.dateDisplay}>
                  <Text style={styles.dateText}>{endDateLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.dateArrow}
                  onPress={() => adjustEndDate(7)}>
                  <Text style={styles.dateArrowText}>{'\u{203A}'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Reminder */}
        <Text style={styles.label}>Reminder</Text>
        <View style={styles.chipRow}>
          {[
            {label: 'None', value: 0},
            {label: '5 min', value: 5},
            {label: '15 min', value: 15},
            {label: '30 min', value: 30},
            {label: '1 hour', value: 60},
          ].map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[
                styles.chip,
                reminderOffset === opt.value && styles.chipSelected,
              ]}
              onPress={() => { Keyboard.dismiss(); setReminderOffset(opt.value); }}>
              <Text
                style={[
                  styles.chipText,
                  reminderOffset === opt.value && styles.chipTextSelected,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* RRULE preview */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>
            {'\u{1F4C5}'} Schedule Preview
          </Text>
          <Text style={styles.previewText}>{rruleDescription}</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!activityName.trim() || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!activityName.trim() || isSaving}
          activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Creating...' : '\u{1F4C5}  Create Schedule'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const useStyles = (theme: Theme) => useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgLight,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  inputWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    backgroundColor: theme.colors.bgLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  suggestionsContainer: {
    ...theme.glassCard,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  suggestionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.glassCard,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  dateArrow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateArrowText: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...theme.glassCard,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  chipTextSelected: {
    color: theme.colors.textOnPrimary,
  },
  // Day chips
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    ...theme.glassCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dayChipTextSelected: {
    color: theme.colors.textOnPrimary,
  },
  // Interval row
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intervalInput: {
    width: 60,
    textAlign: 'center',
  },
  intervalSuffix: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  // Preview
  previewBox: {
    backgroundColor: theme.colors.primaryPale,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.primaryGlow,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  // Save button
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xxl,
    ...theme.shadows.glow,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
}), [theme]);
