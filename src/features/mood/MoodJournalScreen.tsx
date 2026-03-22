/**
 * Mood Journal Screen.
 *
 * After selecting a mood, the user writes free-text about how they're
 * feeling. On save, the mood is logged as a "Mood Tracking" activity
 * with the mood name and journal text as the comment.
 *
 * Since it's logged as an activity, streaks are calculated automatically
 * by the existing streak system.
 */

import React, {useState, useMemo, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme/types';
import {logActivity} from '../../hooks/useActivities';
import {useUIStore} from '../../stores/uiStore';
import {playCelebrationFeedback} from '../../services/feedback';
import {MOOD_ACTIVITY_NAME} from './moodData';
import type {MoodCategoryId} from './moodData';

type Nav = NativeStackNavigationProp<any>;
type Route = RouteProp<
  {
    MoodJournal: {
      categoryId: MoodCategoryId;
      moodName: string;
      moodDescription: string;
      categoryColor: string;
    };
  },
  'MoodJournal'
>;

export default function MoodJournalScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {moodName, moodDescription, categoryColor} = route.params;

  const [journalText, setJournalText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const {showConfetti, showCelebration} = useUIStore();

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    Keyboard.dismiss();
    setIsSaving(true);

    try {
      const comment = journalText.trim()
        ? `${moodName}: ${journalText.trim()}`
        : moodName;

      const result = await logActivity({
        name: MOOD_ACTIVITY_NAME,
        date: new Date(),
        comment,
        source: 'manual',
      });

      playCelebrationFeedback();
      showConfetti('');
      showCelebration(result.streak);

      // Navigate back to the mood category screen (root of the mood stack)
      navigation.popToTop();
    } catch (error) {
      console.error('[MoodJournal] Error saving mood:', error);
      setIsSaving(false);
    }
  }, [
    isSaving,
    journalText,
    moodName,
    navigation,
    showConfetti,
    showCelebration,
  ]);

  return (
    <ScreenWrapper keyboard edges={[]}>
        <View style={styles.content}>
          {/* Mood badge */}
          <View style={[styles.moodBadge, {backgroundColor: categoryColor}]}>
            <Text style={styles.moodBadgeText}>{moodName}</Text>
          </View>

          <Text style={styles.moodDescription}>{moodDescription}</Text>

          <View style={[styles.inputContainer, theme.glassCard]}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="I'm feeling this way because..."
              placeholderTextColor={theme.colors.textMuted}
              value={journalText}
              onChangeText={setJournalText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {backgroundColor: categoryColor},
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Log Mood'}
          </Text>
        </TouchableOpacity>
    </ScreenWrapper>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        keyboardView: {
          flex: 1,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
        },
        moodBadge: {
          alignSelf: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          marginBottom: spacing.md,
        },
        moodBadgeText: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
        moodDescription: {
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginBottom: spacing.lg,
          lineHeight: 20,
        },
        inputContainer: {
          flex: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        textInput: {
          flex: 1,
          fontSize: 16,
          color: theme.colors.text,
          lineHeight: 24,
        },
        saveButton: {
          marginHorizontal: spacing.xl,
          marginBottom: spacing.lg,
          paddingVertical: 16,
          borderRadius: radius.full,
          alignItems: 'center',
        },
        saveButtonDisabled: {
          opacity: 0.6,
        },
        saveButtonText: {
          fontSize: 17,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
      }),
    [theme],
  );
