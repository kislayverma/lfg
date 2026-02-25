import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';

import {database, Activity, ActivityLog, Schedule} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {
  useLogsForActivity,
  useSchedulesForActivity,
} from '../../hooks/useActivities';
import {describeRRule} from '../../services/rruleHelper';
import {formatDateKey, relativeTime} from '../../utils/date';
import {deleteSchedule} from '../../hooks/useSchedule';
import {useUIStore} from '../../stores/uiStore';
import StreakBadge from '../../components/StreakBadge';
import ShareActivitySheet from '../sharing/ShareActivitySheet';
import type {SharePayload} from '../../services/deepLink';
import {useTheme, spacing, radius, emptyStates} from '../../theme';
import type {Theme} from '../../theme';
import type {ActivitiesStackParamList} from '../../navigation/AppNavigator';

type Route = RouteProp<ActivitiesStackParamList, 'ActivityDetail'>;

export default function ActivityDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const showToast = useUIStore(s => s.showToast);
  const {activityId} = route.params;

  const theme = useTheme();
  const styles = useStyles(theme);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const logs = useLogsForActivity(activityId);
  const schedules = useSchedulesForActivity(activityId);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const sub = database
      .get<Activity>('activities')
      .findAndObserve(activityId)
      .subscribe(setActivity);

    return () => sub.unsubscribe();
  }, [activityId]);

  useEffect(() => {
    if (activity) {
      navigation.setOptions({headerTitle: activity.name});
    }
  }, [activity, navigation]);

  const handleDeleteActivity = useCallback(() => {
    Alert.alert(
      'Delete Activity',
      'This will permanently remove this activity and all its logs. Are you sure?',
      [
        {text: 'Keep It', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                const allLogs = await database
                  .get<ActivityLog>('activity_logs')
                  .query(Q.where('activity_id', activityId))
                  .fetch();
                for (const log of allLogs) {
                  await log.destroyPermanently();
                }
                const allSchedules = await database
                  .get<Schedule>('schedules')
                  .query(Q.where('activity_id', activityId))
                  .fetch();
                for (const s of allSchedules) {
                  await s.destroyPermanently();
                }
                const act = await database
                  .get<Activity>('activities')
                  .find(activityId);
                await act.destroyPermanently();
              });
              showToast('Activity deleted');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting activity:', error);
            }
          },
        },
      ],
    );
  }, [activityId, navigation, showToast]);

  const handleDeactivateSchedule = useCallback(
    async (scheduleId: string) => {
      try {
        await deleteSchedule(scheduleId);
        showToast('Schedule removed');
      } catch (error) {
        console.error('Error deactivating schedule:', error);
      }
    },
    [showToast],
  );

  const handleShare = useCallback(
    (schedule: Schedule) => {
      if (!activity) {
        return;
      }
      const dtstart = new Date(schedule.dtstart);
      const time = `${String(dtstart.getHours()).padStart(2, '0')}:${String(dtstart.getMinutes()).padStart(2, '0')}`;
      setSharePayload({
        name: activity.name,
        rrule: schedule.rrule,
        time,
        duration: schedule.durationMinutes,
      });
    },
    [activity],
  );

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const level = theme.getStreakLevel(activity.currentStreak);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}>
      <Animated.View
        style={{opacity: fadeAnim, transform: [{translateY: slideAnim}]}}>
        {/* Activity header */}
        <View style={styles.header}>
          <View
            style={[styles.colorCircle, {backgroundColor: activity.color}]}
          />
          <View style={styles.headerText}>
            <Text style={styles.name}>{activity.name}</Text>
            {activity.currentStreak > 0 && (
              <Text style={[styles.levelText, {color: level.color}]}>
                {level.emoji} {level.label}
              </Text>
            )}
          </View>
          <StreakBadge streak={activity.currentStreak} size="lg" showLabel />
        </View>

        {/* Stats row */}
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
            <Text style={styles.statValue}>{logs.length}</Text>
            <Text style={styles.statLabel}>Total Logs</Text>
          </View>
        </View>

        {/* Schedules section */}
        {schedules.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {'\u{1F4C5}'} Active Schedules
            </Text>
            {schedules.map(schedule => (
              <View key={schedule.id} style={styles.scheduleCard}>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleDesc}>
                    {describeRRule(schedule.rrule, new Date(schedule.dtstart))}
                  </Text>
                  <Text style={styles.scheduleMeta}>
                    {schedule.durationMinutes} min
                    {schedule.reminderOffset > 0
                      ? ` \u{00B7} Reminder ${schedule.reminderOffset}min before`
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShare(schedule)}>
                  <Text style={styles.shareBtnText}>{'\u{1F4E4}'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleDeactivateSchedule(schedule.id)}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Recent logs section */}
        <Text style={styles.sectionTitle}>
          {'\u{1F4DD}'} Recent Logs{' '}
          {logs.length > 0 ? `(${logs.length})` : ''}
        </Text>
        {logs.length === 0 ? (
          <View style={styles.emptyLogs}>
            <Text style={styles.emptyEmoji}>{'\u{1F4DD}'}</Text>
            <Text style={styles.emptyText}>{emptyStates.noLogs.subtitle}</Text>
          </View>
        ) : (
          logs.slice(0, 50).map(log => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logDateCol}>
                <Text style={styles.logDateText}>
                  {formatDateKey(new Date(log.logDate))}
                </Text>
                {log.logTime ? (
                  <Text style={styles.logTimeText}>{log.logTime}</Text>
                ) : null}
              </View>
              <View style={styles.logContent}>
                {log.comment ? (
                  <Text style={styles.logComment} numberOfLines={2}>
                    {log.comment}
                  </Text>
                ) : (
                  <Text style={styles.logNoComment}>\u{2014}</Text>
                )}
                <View style={styles.logSourceBadge}>
                  <Text style={styles.logSource}>
                    {log.source === 'scheduled' ? '\u{1F4C5} Scheduled' : '\u{270F}\u{FE0F} Manual'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteActivity}
          activeOpacity={0.8}>
          <Text style={styles.deleteButtonText}>Delete Activity</Text>
        </TouchableOpacity>
      </Animated.View>

      {sharePayload && (
        <ShareActivitySheet
          visible={!!sharePayload}
          onClose={() => setSharePayload(null)}
          payload={sharePayload}
        />
      )}
    </ScrollView>
  );
}

const useStyles = (theme: Theme) => {
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        scrollContent: {
          padding: spacing.xl,
          paddingBottom: 60,
        },
        loadingText: {
          textAlign: 'center',
          marginTop: 40,
          color: theme.colors.textMuted,
          fontSize: 15,
        },
        // Header
        header: {
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
        headerText: {
          flex: 1,
        },
        name: {
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
        // Sections
        sectionTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          marginBottom: spacing.sm,
          marginTop: spacing.xs,
        },
        // Schedules
        scheduleCard: {
          flexDirection: 'row',
          alignItems: 'center',
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        scheduleInfo: {
          flex: 1,
        },
        scheduleDesc: {
          fontSize: 14,
          fontWeight: '500',
          color: theme.colors.text,
        },
        scheduleMeta: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
        shareBtn: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.primaryPale,
          marginRight: spacing.xs,
        },
        shareBtnText: {
          fontSize: 14,
        },
        removeBtn: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.dangerPale,
        },
        removeBtnText: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.danger,
        },
        // Logs
        logCard: {
          flexDirection: 'row',
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.xs,
        },
        logDateCol: {
          width: 90,
          marginRight: spacing.md,
        },
        logDateText: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.text,
        },
        logTimeText: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginTop: 1,
        },
        logContent: {
          flex: 1,
        },
        logComment: {
          fontSize: 14,
          color: theme.colors.textSecondary,
        },
        logNoComment: {
          fontSize: 14,
          color: theme.colors.textMuted,
        },
        logSourceBadge: {
          marginTop: spacing.xs,
        },
        logSource: {
          fontSize: 11,
          color: theme.colors.textMuted,
        },
        emptyLogs: {
          alignItems: 'center',
          paddingVertical: spacing.xxl,
        },
        emptyEmoji: {
          fontSize: 32,
          marginBottom: spacing.sm,
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 14,
        },
        // Delete
        deleteButton: {
          backgroundColor: theme.colors.dangerPale,
          borderRadius: radius.md,
          padding: 16,
          alignItems: 'center',
          marginTop: spacing.xxxl,
        },
        deleteButtonText: {
          color: theme.colors.danger,
          fontSize: 16,
          fontWeight: '600',
        },
      }),
    [theme],
  );
};
