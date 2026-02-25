import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  NativeModules,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useActivitySearch} from '../../hooks/useActivities';
import {logActivity} from '../../hooks/useActivities';
import {useUIStore} from '../../stores/uiStore';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {HomeStackParamList} from '../../navigation/AppNavigator';
import {playCelebrationFeedback} from '../../services/feedback';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'LogActivity'>;
type Route = RouteProp<HomeStackParamList, 'LogActivity'>;

export default function LogActivityScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const showConfetti = useUIStore(s => s.showConfetti);
  const showCelebration = useUIStore(s => s.showCelebration);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Match the system nav bar color to this modal's background on Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      NativeModules.NavigationBarColor?.setColor(
        theme.colors.bgLight,
        !theme.statusBarLight,
      );
      return () => {
        // Restore main bg color when leaving the modal
        NativeModules.NavigationBarColor?.setColor(
          theme.colors.bg,
          !theme.statusBarLight,
        );
      };
    }
  }, [theme]);

  const initialDate = route.params?.date
    ? new Date(route.params.date)
    : new Date();

  const [activityName, setActivityName] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchResults = useActivitySearch(activityName);

  const handleSelectSuggestion = useCallback((name: string) => {
    setActivityName(name);
    setShowSuggestions(false);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = activityName.trim();
    if (!trimmed) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await logActivity({
        name: trimmed,
        date: selectedDate,
        time: time.trim() || undefined,
        comment: comment.trim() || undefined,
        source: 'manual',
      });

      playCelebrationFeedback();
      showConfetti('');
      showCelebration(result.streak);
      navigation.goBack();
    } catch (error) {
      console.error('Error logging activity:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activityName, selectedDate, time, comment, showConfetti, showCelebration, navigation]);

  const adjustDate = useCallback(
    (days: number) => {
      Keyboard.dismiss();
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + days);
      setSelectedDate(d);
    },
    [selectedDate],
  );

  const dateLabel = selectedDate.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isToday =
    selectedDate.toDateString() === new Date().toDateString();

  const styles = useStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, {paddingBottom: Math.max(40, insets.bottom + 16)}]}
        keyboardShouldPersistTaps="handled">
        {/* Activity name input with autocomplete */}
        <Text style={styles.label}>What did you accomplish?</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Morning run, Read 20 pages..."
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
            returnKeyType="next"
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
                  {activity.currentStreak > 0 && (
                    <Text style={styles.suggestionStreak}>
                      {'\u{1F525}'} {activity.currentStreak}d
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date picker */}
        <Text style={styles.label}>When?</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => adjustDate(-1)}>
            <Text style={styles.dateArrowText}>{'\u{2039}'}</Text>
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>{dateLabel}</Text>
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>Today</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => adjustDate(1)}>
            <Text style={styles.dateArrowText}>{'\u{203A}'}</Text>
          </TouchableOpacity>
        </View>

        {/* Time input */}
        <Text style={styles.label}>Time (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 07:30"
          placeholderTextColor={theme.colors.textMuted}
          value={time}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
          returnKeyType="next"
        />

        {/* Comment input */}
        <Text style={styles.label}>How did it go? (optional)</Text>
        <TextInput
          style={[styles.input, styles.commentInput]}
          placeholder="Share a quick note about today's effort..."
          placeholderTextColor={theme.colors.textMuted}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="done"
        />

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
            {isSaving ? 'Saving...' : '\u{2705}  Log It!'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
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
        commentInput: {
          minHeight: 80,
          paddingTop: 14,
        },
        // Autocomplete suggestions
        suggestionsContainer: {
          backgroundColor: theme.colors.card,
          borderRadius: radius.md,
          marginTop: spacing.xs,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        },
        suggestionItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
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
        suggestionStreak: {
          fontSize: 12,
          color: theme.colors.primary,
          fontWeight: '600',
        },
        // Date row
        dateRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
        },
        dateText: {
          fontSize: 15,
          fontWeight: '500',
          color: theme.colors.text,
        },
        todayBadge: {
          marginLeft: spacing.sm,
          backgroundColor: theme.colors.primaryPale,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: radius.sm,
        },
        todayBadgeText: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.colors.primary,
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
      }),
    [theme],
  );
