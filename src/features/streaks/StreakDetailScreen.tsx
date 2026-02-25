import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';

import {database, Activity, ActivityLog, Schedule} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {expandRRule} from '../../services/rruleHelper';
import {formatDateKey, todayMidnight, previousDay} from '../../utils/date';
import StreakBadge from '../../components/StreakBadge';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {StreaksStackParamList} from '../../navigation/AppNavigator';

type Route = RouteProp<StreaksStackParamList, 'StreakDetail'>;

interface StreakLog {
  id: string;
  dateKey: string;
  logDate: number;
  logTime: string | null;
  comment: string | null;
  source: string;
}

export default function StreakDetailScreen() {
  const route = useRoute<Route>();
  const {activityId} = route.params;
  const theme = useTheme();
  const styles = useStyles(theme);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [streakLogs, setStreakLogs] = useState<StreakLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStreakLogs() {
      try {
        const act = await database
          .get<Activity>('activities')
          .find(activityId);
        if (cancelled) {
          return;
        }
        setActivity(act);

        // Get active schedules
        const activeSchedules = await database
          .get<Schedule>('schedules')
          .query(
            Q.where('activity_id', activityId),
            Q.where('is_active', true),
          )
          .fetch();

        // Get all logs sorted descending
        const allLogs = await database
          .get<ActivityLog>('activity_logs')
          .query(
            Q.where('activity_id', activityId),
            Q.sortBy('log_date', Q.desc),
          )
          .fetch();

        // Build log date set and log-by-date map
        const logDateSet = new Set<string>();
        const logsByDate: Record<string, ActivityLog[]> = {};
        for (const log of allLogs) {
          const key = formatDateKey(new Date(log.logDate));
          logDateSet.add(key);
          if (!logsByDate[key]) {
            logsByDate[key] = [];
          }
          logsByDate[key].push(log);
        }

        // Determine streak dates (same logic as streakEngine)
        const today = todayMidnight();
        const streakDates: string[] = [];

        if (activeSchedules.length > 0) {
          // Scheduled streak: consecutive scheduled dates with logs
          const allScheduledDates: Date[] = [];
          for (const schedule of activeSchedules) {
            const dtstart = new Date(schedule.dtstart);
            const dates = expandRRule(schedule.rrule, dtstart, today);
            allScheduledDates.push(...dates);
          }

          const seen = new Set<string>();
          const sortedDates = allScheduledDates
            .filter(d => d <= today)
            .sort((a, b) => b.getTime() - a.getTime())
            .filter(d => {
              const key = formatDateKey(d);
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            });

          for (const date of sortedDates) {
            const dateKey = formatDateKey(date);
            if (logDateSet.has(dateKey)) {
              streakDates.push(dateKey);
            } else {
              break;
            }
          }
        } else {
          // Unscheduled streak: consecutive calendar days with logs
          let currentDate = today;
          while (logDateSet.has(formatDateKey(currentDate))) {
            streakDates.push(formatDateKey(currentDate));
            currentDate = previousDay(currentDate);
          }
        }

        // Collect logs for each streak date
        const result: StreakLog[] = [];
        for (const dateKey of streakDates) {
          const dateLogs = logsByDate[dateKey] || [];
          for (const log of dateLogs) {
            result.push({
              id: log.id,
              dateKey,
              logDate: log.logDate,
              logTime: log.logTime,
              comment: log.comment,
              source: log.source,
            });
          }
        }

        if (!cancelled) {
          setStreakLogs(result);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading streak logs:', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStreakLogs();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const renderItem = useMemo(
    () =>
      ({item}: {item: StreakLog}) => {
        const date = new Date(item.logDate);
        const dayLabel = date.toLocaleDateString('default', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        return (
          <View style={styles.logCard}>
            <View style={styles.logDateSection}>
              <Text style={styles.logDayLabel}>{dayLabel}</Text>
              {item.logTime ? (
                <Text style={styles.logTimeText}>{item.logTime}</Text>
              ) : null}
            </View>
            <View style={styles.logBody}>
              {item.comment && item.comment.trim() ? (
                <Text style={styles.logComment}>{item.comment}</Text>
              ) : (
                <Text style={styles.logNoComment}>No comment</Text>
              )}
            </View>
          </View>
        );
      },
    [styles],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Activity not found</Text>
      </View>
    );
  }

  const level = theme.getStreakLevel(activity.currentStreak);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={streakLogs}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View
              style={[styles.colorCircle, {backgroundColor: activity.color}]}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.activityName}>{activity.name}</Text>
              {activity.currentStreak > 0 && (
                <Text style={[styles.levelText, {color: level.color}]}>
                  {level.emoji} {level.label}
                </Text>
              )}
            </View>
            <StreakBadge
              streak={activity.currentStreak}
              size="lg"
              showLabel
            />
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={[styles.statValue, styles.statValueHighlight]}>
                {activity.currentStreak}
              </Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activity.longestStreak}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{streakLogs.length}</Text>
              <Text style={styles.statLabel}>Logs in Streak</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            {`\u{1F4DD} Streak Activity (${streakLogs.length})`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{'\u{1F4AD}'}</Text>
          <Text style={styles.emptyText}>
            No active streak. Log an activity to start one!
          </Text>
        </View>
      }
    />
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
        content: {
          padding: spacing.xl,
          paddingBottom: 60,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        },
        // Header
        header: {
          marginBottom: spacing.md,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.xl,
        },
        colorCircle: {
          width: 24,
          height: 24,
          borderRadius: 12,
          marginRight: spacing.md,
        },
        headerInfo: {
          flex: 1,
        },
        activityName: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
        },
        levelText: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 2,
        },
        // Stats
        statsRow: {
          flexDirection: 'row',
          gap: 10,
          marginBottom: spacing.xxl,
        },
        statCard: {
          flex: 1,
          ...theme.glassCard,
          borderRadius: radius.lg,
          paddingVertical: 16,
          alignItems: 'center',
        },
        statCardHighlight: {
          backgroundColor: theme.colors.primaryPale,
          borderColor: theme.colors.primaryGlow,
        },
        statValue: {
          fontSize: 24,
          fontWeight: '800',
          color: theme.colors.text,
        },
        statValueHighlight: {
          color: theme.colors.primary,
        },
        statLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: theme.colors.textMuted,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        // Section
        sectionTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          marginBottom: spacing.sm,
        },
        // Log cards
        logCard: {
          flexDirection: 'row',
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        logDateSection: {
          width: 100,
          marginRight: spacing.md,
        },
        logDayLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.text,
        },
        logTimeText: {
          fontSize: 12,
          color: theme.colors.primary,
          fontWeight: '500',
          marginTop: 2,
        },
        logBody: {
          flex: 1,
        },
        logComment: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          lineHeight: 20,
        },
        logNoComment: {
          fontSize: 14,
          color: theme.colors.textMuted,
          fontStyle: 'italic',
        },
        // Empty
        emptyContainer: {
          alignItems: 'center',
          paddingVertical: spacing.xxxl,
        },
        emptyEmoji: {
          fontSize: 36,
          marginBottom: spacing.sm,
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 14,
        },
      }),
    [theme],
  );
