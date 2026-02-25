import React, {useCallback, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';

import {createSchedule} from '../../hooks/useSchedule';
import {logActivity} from '../../hooks/useActivities';
import {useUIStore} from '../../stores/uiStore';
import {useAuthStore} from '../../stores/authStore';
import {describeRRule} from '../../services/rruleHelper';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {HomeStackParamList} from '../../navigation/AppNavigator';
import {playCelebrationFeedback} from '../../services/feedback';

type Route = RouteProp<HomeStackParamList, 'ReceiveShare'>;

export default function ReceiveShareScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const showToast = useUIStore(s => s.showToast);
  const showConfetti = useUIStore(s => s.showConfetti);
  const showCelebration = useUIStore(s => s.showCelebration);
  const currentUser = useAuthStore(s => s.currentUser);
  const theme = useTheme();
  const styles = useStyles(theme);

  const {name, rrule, time, duration} = route.params;
  const [isSaving, setIsSaving] = useState(false);

  // Build dtstart from time string (HH:mm)
  const dtstart = useMemo(() => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    now.setHours(hours || 0, minutes || 0, 0, 0);
    // If the time is already past today, start from tomorrow
    if (now.getTime() < Date.now()) {
      now.setDate(now.getDate() + 1);
    }
    return now;
  }, [time]);

  const rruleDescription = useMemo(
    () => describeRRule(rrule, dtstart),
    [rrule, dtstart],
  );

  const handleAddToCalendar = useCallback(async () => {
    if (!currentUser?.id) {
      Alert.alert('Not Logged In', 'Please log in to add shared activities.');
      return;
    }

    setIsSaving(true);
    try {
      // Log the activity (creates it if new) to get the activityId
      const result = await logActivity({
        name,
        date: new Date(),
        source: 'manual',
      });

      // Create the schedule
      await createSchedule({
        activityId: result.activityId,
        rrule,
        dtstart,
        durationMinutes: duration,
        reminderOffset: 15, // Default 15 min reminder
      });

      playCelebrationFeedback();
      showConfetti('');
      showCelebration(result.streak);
      navigation.goBack();
    } catch (error) {
      console.error('Error adding shared activity:', error);
      showToast('Failed to add activity');
    } finally {
      setIsSaving(false);
    }
  }, [
    currentUser,
    name,
    rrule,
    dtstart,
    duration,
    showConfetti,
    showCelebration,
    showToast,
    navigation,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>{'\u{1F91D}'}</Text>
        <Text style={styles.heading}>Someone shared an activity!</Text>

        <View style={styles.detail}>
          <Text style={styles.label}>Activity</Text>
          <Text style={styles.value}>{name}</Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.label}>Schedule</Text>
          <Text style={styles.value}>{rruleDescription}</Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>{time}</Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.value}>{duration} minutes</Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, isSaving && styles.addButtonDisabled]}
          onPress={handleAddToCalendar}
          disabled={isSaving}
          activeOpacity={0.8}>
          <Text style={styles.addButtonText}>
            {isSaving
              ? 'Adding...'
              : `\u{2795} Add "${name}" to My Calendar`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
          justifyContent: 'center',
          padding: spacing.xl,
        },
        card: {
          backgroundColor: theme.colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          padding: spacing.xxl,
          alignItems: 'center',
        },
        emoji: {
          fontSize: 48,
          marginBottom: spacing.md,
        },
        heading: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: spacing.xxl,
        },
        detail: {
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        label: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
        value: {
          fontSize: 14,
          fontWeight: '500',
          color: theme.colors.text,
          flex: 1,
          textAlign: 'right',
          marginLeft: spacing.md,
        },
        addButton: {
          width: '100%',
          backgroundColor: theme.colors.primary,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: spacing.xxl,
          ...theme.shadows.glow,
        },
        addButtonDisabled: {
          opacity: 0.5,
        },
        addButtonText: {
          color: theme.colors.textOnPrimary,
          fontSize: 16,
          fontWeight: '700',
        },
        cancelButton: {
          marginTop: spacing.md,
          paddingVertical: spacing.sm,
        },
        cancelButtonText: {
          fontSize: 14,
          color: theme.colors.textMuted,
        },
      }),
    [theme],
  );
