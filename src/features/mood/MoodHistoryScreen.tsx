/**
 * Mood History Screen.
 *
 * Shows a chronological list of all mood entries, grouped by date.
 * Each entry shows the mood name, timestamp, and journal text.
 * The mood name is color-coded by its category.
 */

import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {database, Activity, ActivityLog} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {useAuthStore} from '../../stores/authStore';
import {useTheme, spacing, radius, typography} from '../../theme';
import type {Theme} from '../../theme/types';
import {MOOD_ACTIVITY_NAME, MOOD_CATEGORIES} from './moodData';

interface MoodEntry {
  id: string;
  moodName: string;
  journalText: string | null;
  logDate: number;
  createdAt: Date;
  categoryColor: string;
}

/**
 * Determine the category color for a mood name by searching all categories.
 */
function getColorForMood(moodName: string): string {
  for (const cat of MOOD_CATEGORIES) {
    if (cat.moods.some(m => m.name === moodName)) {
      return cat.color;
    }
  }
  return '#888';
}

/**
 * Parse the comment field to extract mood name and journal text.
 * Comment format: "MoodName: journal text" or just "MoodName"
 */
function parseComment(comment: string | null): {
  moodName: string;
  journalText: string | null;
} {
  if (!comment) {
    return {moodName: 'Unknown', journalText: null};
  }

  const colonIndex = comment.indexOf(':');
  if (colonIndex === -1) {
    return {moodName: comment.trim(), journalText: null};
  }

  const moodName = comment.slice(0, colonIndex).trim();
  const journalText = comment.slice(colonIndex + 1).trim();
  return {moodName, journalText: journalText || null};
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logDay = new Date(timestamp);
  logDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - logDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('default', {weekday: 'long'});
  }
  return date.toLocaleDateString('default', {
    month: 'short',
    day: 'numeric',
    year: today.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('default', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MoodHistoryScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    // First find the "Mood Tracking" activity
    const activityCollection = database.get<Activity>('activities');
    const logCollection = database.get<ActivityLog>('activity_logs');

    let sub: {unsubscribe: () => void} | null = null;

    (async () => {
      const activities = await activityCollection
        .query(
          Q.where('user_id', userId),
          Q.where(
            'name_normalized',
            MOOD_ACTIVITY_NAME.toLowerCase().trim(),
          ),
        )
        .fetch();

      if (activities.length === 0) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      const activityId = activities[0].id;

      // Observe logs for this activity
      sub = logCollection
        .query(
          Q.where('activity_id', activityId),
          Q.sortBy('created_at', Q.desc),
        )
        .observe()
        .subscribe(logs => {
          const mapped: MoodEntry[] = logs.map(log => {
            const {moodName, journalText} = parseComment(log.comment);
            return {
              id: log.id,
              moodName,
              journalText,
              logDate: log.logDate,
              createdAt: log.createdAt,
              categoryColor: getColorForMood(moodName),
            };
          });
          setEntries(mapped);
          setIsLoading(false);
        });
    })();

    return () => {
      sub?.unsubscribe();
    };
  }, [userId]);

  const renderItem = ({item}: {item: MoodEntry}) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View
          style={[styles.moodDot, {backgroundColor: item.categoryColor}]}
        />
        <Text style={[styles.entryMood, {color: item.categoryColor}]}>
          {item.moodName}
        </Text>
        <Text style={styles.entryTime}>{formatTime(item.createdAt)}</Text>
      </View>
      {item.journalText && (
        <Text style={styles.entryJournal} numberOfLines={3}>
          {item.journalText}
        </Text>
      )}
      <Text style={styles.entryDate}>{formatDate(item.logDate)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F60A}'}</Text>
          <Text style={styles.emptyTitle}>No mood entries yet</Text>
          <Text style={styles.emptyText}>
            Track your first mood to see your history here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
        listContent: {
          padding: spacing.xl,
          paddingBottom: 40,
        },
        entryCard: {
          ...theme.glassCard,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
        entryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        },
        moodDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          marginRight: spacing.sm,
        },
        entryMood: {
          fontSize: 16,
          fontWeight: '700',
          flex: 1,
        },
        entryTime: {
          fontSize: 12,
          color: theme.colors.textMuted,
        },
        entryJournal: {
          fontSize: 14,
          color: theme.colors.text,
          lineHeight: 20,
          marginTop: 4,
          marginBottom: 6,
        },
        entryDate: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginTop: 4,
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xxxl,
        },
        emptyIcon: {
          fontSize: 48,
          marginBottom: spacing.lg,
        },
        emptyTitle: {
          ...typography.heading,
          color: theme.colors.text,
          marginBottom: spacing.sm,
        },
        emptyText: {
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [theme],
  );
