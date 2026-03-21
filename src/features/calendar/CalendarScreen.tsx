import React, {useCallback, useEffect, useState, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {database, Activity, ActivityLog} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {
  useSchedulesForDate,
  skipScheduleInstance,
  skipAllFutureInstances,
} from '../../hooks/useSchedule';
import {logActivity} from '../../hooks/useActivities';
import {useUIStore} from '../../stores/uiStore';
import {playCelebrationFeedback} from '../../services/feedback';
import {
  getCalendarDays,
  formatDateKey,
  toMidnightTimestamp,
} from '../../utils/date';
import {useAuthStore} from '../../stores/authStore';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {HomeStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        },
        navButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          ...theme.glassCard,
          justifyContent: 'center',
          alignItems: 'center',
          ...theme.shadows.sm,
        },
        navButtonText: {
          fontSize: 24,
          fontWeight: '600',
          color: theme.colors.primary,
          marginTop: -2,
        },
        headerCenter: {
          alignItems: 'center',
        },
        monthLabel: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
        },
        monthSummary: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
        weekdayRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.xs,
        },
        weekdayText: {
          flex: 1,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textMuted,
        },
        grid: {
          flex: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: spacing.sm,
        },
        dayCell: {
          width: '14.28%',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: radius.sm,
        },
        todayCell: {
          backgroundColor: theme.colors.primaryPale,
        },
        selectedCell: {
          backgroundColor: theme.colors.primaryGlow,
        },
        dayText: {
          fontSize: 15,
          fontWeight: '500',
          color: theme.colors.text,
        },
        otherMonthText: {
          color: theme.colors.textMuted,
        },
        todayText: {
          color: theme.colors.primary,
          fontWeight: '700',
        },
        selectedText: {
          color: theme.colors.primary,
          fontWeight: '700',
        },
        dotsRow: {
          flexDirection: 'row',
          marginTop: 3,
          height: 6,
        },
        dot: {
          width: 5,
          height: 5,
          borderRadius: 2.5,
          marginHorizontal: 1,
        },
        // Bottom sheet
        sheetOverlay: {
          flex: 1,
          backgroundColor: theme.statusBarLight
            ? 'rgba(0,0,0,0.6)'
            : 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        },
        sheetOverlayDismiss: {
          flex: 1,
        },
        sheet: {
          backgroundColor: theme.colors.bgLight,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 40,
          maxHeight: '60%',
        },
        sheetExpanded: {
          maxHeight: '80%',
        },
        sheetDragArea: {
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        },
        sheetHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
        },
        sheetTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: spacing.lg,
        },
        sheetContent: {
          flexGrow: 0,
          flexShrink: 1,
        },
        sectionLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.sm,
          marginTop: spacing.xs,
        },
        scheduleItem: {
          flexDirection: 'row',
          alignItems: 'center',
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        colorBar: {
          width: 4,
          height: 36,
          borderRadius: 2,
          marginRight: spacing.md,
        },
        scheduleItemColumn: {
          flexDirection: 'column',
          alignItems: 'stretch',
        },
        scheduleInfo: {
          flex: 1,
        },
        scheduleText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.text,
        },
        scheduleMeta: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
        scheduleActions: {
          flexDirection: 'row',
          gap: spacing.xs,
        },
        skipBtn: {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        skipBtnText: {
          color: theme.colors.textSecondary,
          fontSize: 13,
          fontWeight: '600',
        },
        skipConfirmArea: {
          marginTop: spacing.xs,
        },
        skipConfirmText: {
          fontSize: 13,
          color: theme.colors.textSecondary,
          marginBottom: spacing.xs,
        },
        stopAllBtn: {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.danger,
        },
        stopAllBtnText: {
          color: theme.colors.textOnPrimary,
          fontSize: 13,
          fontWeight: '600',
        },
        markDoneBtn: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: radius.sm,
          ...theme.shadows.glow,
        },
        markDoneBtnText: {
          color: theme.colors.textOnPrimary,
          fontSize: 13,
          fontWeight: '600',
        },
        commentInputArea: {
          marginTop: spacing.sm,
        },
        commentInput: {
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          fontSize: 13,
          color: theme.colors.text,
          minHeight: 36,
          maxHeight: 72,
        },
        commentActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          marginTop: spacing.xs,
        },
        commentSkipBtn: {
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: radius.sm,
        },
        commentSkipText: {
          color: theme.colors.textSecondary,
          fontSize: 13,
          fontWeight: '600',
        },
        commentSaveBtn: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 5,
          borderRadius: radius.sm,
        },
        commentSaveText: {
          color: theme.colors.textOnPrimary,
          fontSize: 13,
          fontWeight: '600',
        },
        doneBadge: {
          backgroundColor: theme.colors.successPale,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: radius.sm,
        },
        doneLabel: {
          color: theme.colors.success,
          fontWeight: '600',
          fontSize: 13,
        },
        skippedBadge: {
          backgroundColor: theme.colors.dangerPale,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: radius.sm,
        },
        skippedLabel: {
          color: theme.colors.danger,
          fontWeight: '600',
          fontSize: 13,
        },
        logItem: {
          flexDirection: 'row',
          alignItems: 'center',
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        logInfo: {
          flex: 1,
        },
        logText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.text,
        },
        logComment: {
          fontSize: 13,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
        logMeta: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginTop: 2,
        },
        emptySheet: {
          alignItems: 'center',
          paddingVertical: spacing.xxxl,
        },
        emptyEmoji: {
          fontSize: 36,
          marginBottom: spacing.sm,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: spacing.xs,
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 14,
        },
        sheetActions: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
        },
        sheetActionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          gap: spacing.xs,
          ...theme.shadows.sm,
        },
        sheetActionBtnAlt: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.glassCard,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          gap: spacing.xs,
        },
        sheetActionIcon: {
          fontSize: 16,
        },
        sheetActionLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.textOnPrimary,
        },
        sheetActionLabelAlt: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.text,
        },
        sheetActionDisabled: {
          opacity: 0.35,
        },
        sheetActionLabelDisabled: {
          color: theme.colors.textMuted,
        },
      }),
    [theme],
  );

export default function CalendarScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const {currentMonth, currentYear, setCurrentMonth, showConfetti, showCelebration} = useUIStore();
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [logsByDate, setLogsByDate] = useState<Record<string, ActivityLog[]>>(
    {},
  );
  const [activitiesMap, setActivitiesMap] = useState<Record<string, Activity>>(
    {},
  );
  const [gridHeight, setGridHeight] = useState(0);

  useEffect(() => {
    setCalendarDays(getCalendarDays(currentYear, currentMonth));
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (calendarDays.length === 0 || !userId) {
      return;
    }

    const startTs = toMidnightTimestamp(calendarDays[0]);
    const endTs = toMidnightTimestamp(calendarDays[calendarDays.length - 1]);

    const logsCollection = database.get<ActivityLog>('activity_logs');
    const sub = logsCollection
      .query(
        Q.where('user_id', userId),
        Q.where('log_date', Q.gte(startTs)),
        Q.where('log_date', Q.lte(endTs)),
      )
      .observe()
      .subscribe(logs => {
        const grouped: Record<string, ActivityLog[]> = {};
        for (const log of logs) {
          const key = formatDateKey(new Date(log.logDate));
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(log);
        }
        setLogsByDate(grouped);
      });

    return () => sub.unsubscribe();
  }, [calendarDays, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const sub = database
      .get<Activity>('activities')
      .query(Q.where('user_id', userId))
      .observe()
      .subscribe(activities => {
        const map: Record<string, Activity> = {};
        for (const a of activities) {
          map[a.id] = a;
        }
        setActivitiesMap(map);
      });

    return () => sub.unsubscribe();
  }, [userId]);

  const goToPrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11, currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1, currentYear);
    }
  }, [currentMonth, currentYear, setCurrentMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0, currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1, currentYear);
    }
  }, [currentMonth, currentYear, setCurrentMonth]);

  const monthLabel = new Date(currentYear, currentMonth).toLocaleString(
    'default',
    {month: 'long', year: 'numeric'},
  );

  const todayKey = formatDateKey(new Date());
  const numRows = Math.ceil(calendarDays.length / 7);
  const rowHeight = numRows > 0 && gridHeight > 0 ? gridHeight / numRows : 0;

  const handleGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridHeight(e.nativeEvent.layout.height);
  }, []);

  const handleDatePress = useCallback((day: Date) => {
    setSelectedDate(day);
  }, []);

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;

  // Count total logged days this month
  const loggedDaysCount = Object.keys(logsByDate).filter(key => {
    const [, m] = key.split('-');
    return parseInt(m, 10) - 1 === currentMonth;
  }).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Month header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>{'\u{2039}'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          {loggedDaysCount > 0 && (
            <Text style={styles.monthSummary}>
              {loggedDaysCount} active day{loggedDaysCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>{'\u{203A}'}</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday row */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(d => (
          <Text key={d} style={styles.weekdayText}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid} onLayout={handleGridLayout}>
        {calendarDays.map((day, idx) => {
          const dateKey = formatDateKey(day);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDateKey;
          const dayLogs = logsByDate[dateKey] || [];

          const dotColors: string[] = [];
          const seen = new Set<string>();
          for (const log of dayLogs) {
            const act = activitiesMap[log.activityId];
            if (act && !seen.has(act.id)) {
              seen.add(act.id);
              dotColors.push(act.color);
            }
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dayCell,
                {height: rowHeight || undefined},
                isToday && styles.todayCell,
                isSelected && styles.selectedCell,
              ]}
              onPress={() => handleDatePress(day)}
              activeOpacity={0.6}>
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.otherMonthText,
                  isToday && styles.todayText,
                  isSelected && styles.selectedText,
                ]}>
                {day.getDate()}
              </Text>
              <View style={styles.dotsRow}>
                {dotColors.slice(0, 3).map((color, i) => (
                  <View
                    key={i}
                    style={[styles.dot, {backgroundColor: color}]}
                  />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day detail bottom sheet */}
      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          dateKey={formatDateKey(selectedDate)}
          logs={logsByDate[formatDateKey(selectedDate)] || []}
          activitiesMap={activitiesMap}
          onClose={() => setSelectedDate(null)}
          onLogActivity={() => {
            setSelectedDate(null);
            navigation.navigate('LogActivity', {date: formatDateKey(selectedDate)});
          }}
          onScheduleActivity={() => {
            const dateStr = formatDateKey(selectedDate);
            setSelectedDate(null);
            navigation.navigate('ScheduleActivity', {date: dateStr});
          }}
          onMarkDone={async (scheduleId, activityId, comment) => {
            if (!activityId) {
              // Ad-hoc schedule — nothing to log
              return;
            }
            const act = activitiesMap[activityId];
            if (!act) {
              return;
            }
            const result = await logActivity({
              name: act.name,
              date: selectedDate,
              source: 'scheduled',
              scheduleId,
              comment: comment || undefined,
            });
            setSelectedDate(null);
            playCelebrationFeedback();
            showConfetti('');
            showCelebration(result.streak);
          }}
          onSkipInstance={async (scheduleId) => {
            await skipScheduleInstance(scheduleId, selectedDate);
          }}
          onSkipAllFuture={async (scheduleId) => {
            await skipAllFutureInstances(scheduleId, selectedDate);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function DayDetailSheet({
  date,
  dateKey,
  logs,
  activitiesMap,
  onClose,
  onLogActivity,
  onScheduleActivity,
  onMarkDone,
  onSkipInstance,
  onSkipAllFuture,
}: {
  date: Date;
  dateKey: string;
  logs: ActivityLog[];
  activitiesMap: Record<string, Activity>;
  onClose: () => void;
  onLogActivity: () => void;
  onScheduleActivity: () => void;
  onMarkDone: (scheduleId: string, activityId: string | null, comment: string) => void;
  onSkipInstance: (scheduleId: string) => Promise<void>;
  onSkipAllFuture: (scheduleId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const scheduledItems = useSchedulesForDate(dateKey);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [confirmStopAll, setConfirmStopAll] = useState(false);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // Swipe-to-dismiss
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture if swiping down AND the scroll is at the top
        return (
          gs.dy > 10 &&
          Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5 &&
          scrollOffsetRef.current <= 0
        );
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    }),
  ).current;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastDate = date < today;
  const dateLabel = date.toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const doneScheduleIds = new Set(
    logs
      .filter(l => l.source === 'scheduled' && l.scheduleId)
      .map(l => l.scheduleId),
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetOverlayDismiss} onPress={onClose} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            commentingId ? styles.sheetExpanded : null,
            {transform: [{translateY}]},
          ]}>
          <View style={styles.sheetDragArea}>
            <View style={styles.sheetHandle} />
          </View>
          <Text style={styles.sheetTitle}>{dateLabel}</Text>

          <ScrollView
            style={styles.sheetContent}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={e => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            keyboardShouldPersistTaps="handled">
            {/* Scheduled activities (hide completed ones — they appear under Logged) */}
            {scheduledItems.some(({schedule}) => !doneScheduleIds.has(schedule.id)) && (
              <>
                <Text style={styles.sectionLabel}>
                  {'\u{1F4C5}'} Scheduled
                </Text>
                {scheduledItems
                  .filter(({schedule}) => !doneScheduleIds.has(schedule.id))
                  .map(({schedule, activityId}) => {
                  const act = activityId ? activitiesMap[activityId] : null;
                  const displayName = act?.name || schedule.adHocName || 'Unknown';
                  const isAdHoc = !activityId;
                  const dtstart = new Date(schedule.dtstart);
                  const startTime = `${String(dtstart.getHours()).padStart(2, '0')}:${String(dtstart.getMinutes()).padStart(2, '0')}`;
                  const endDate = new Date(dtstart.getTime() + schedule.durationMinutes * 60 * 1000);
                  const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                  const isCommenting = commentingId === schedule.id;
                  return (
                    <View
                      key={schedule.id}
                      style={[
                        styles.scheduleItem,
                        isCommenting && styles.scheduleItemColumn,
                      ]}>
                      <View style={styles.scheduleInfo}>
                        <Text style={styles.scheduleText}>
                          {displayName}
                        </Text>
                        <Text style={styles.scheduleMeta}>
                          {`${startTime} \u{2013} ${endTime} (${schedule.durationMinutes} min)`}
                        </Text>
                      </View>
                      {skippedIds.has(schedule.id) ? (
                        <View style={styles.skippedBadge}>
                          <Text style={styles.skippedLabel}>
                            {'\u{274C}'} Skipped
                          </Text>
                        </View>
                      ) : commentingId === schedule.id ? (
                        <View style={styles.commentInputArea}>
                          <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment (optional)"
                            placeholderTextColor={theme.colors.textMuted}
                            value={commentText}
                            onChangeText={setCommentText}
                            autoFocus
                            multiline
                          />
                          <View style={styles.commentActions}>
                            <TouchableOpacity
                              style={styles.commentSkipBtn}
                              onPress={() => {
                                onMarkDone(schedule.id, activityId, '');
                                setCommentingId(null);
                                setCommentText('');
                              }}>
                              <Text style={styles.commentSkipText}>Skip</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.commentSaveBtn}
                              onPress={() => {
                                onMarkDone(schedule.id, activityId, commentText.trim());
                                setCommentingId(null);
                                setCommentText('');
                              }}>
                              <Text style={styles.commentSaveText}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : skippingId === schedule.id ? (
                        <View style={styles.skipConfirmArea}>
                          {confirmStopAll ? (
                            <>
                              <Text style={styles.skipConfirmText}>
                                End this recurring schedule from today?
                              </Text>
                              <View style={styles.scheduleActions}>
                                <TouchableOpacity
                                  style={styles.skipBtn}
                                  onPress={() => {
                                    setSkippingId(null);
                                    setConfirmStopAll(false);
                                  }}>
                                  <Text style={styles.skipBtnText}>No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.stopAllBtn}
                                  onPress={() => {
                                    onSkipAllFuture(schedule.id);
                                    setSkippedIds(prev => new Set(prev).add(schedule.id));
                                    setSkippingId(null);
                                    setConfirmStopAll(false);
                                  }}>
                                  <Text style={styles.stopAllBtnText}>
                                    Yes, stop it
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </>
                          ) : (
                            <View style={styles.scheduleActions}>
                              <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => {
                                  setSkippingId(null);
                                }}>
                                <Text style={styles.skipBtnText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => {
                                  onSkipInstance(schedule.id);
                                  setSkippedIds(prev => new Set(prev).add(schedule.id));
                                  setSkippingId(null);
                                }}>
                                <Text style={styles.skipBtnText}>
                                  This day
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.stopAllBtn}
                                onPress={() => setConfirmStopAll(true)}>
                                <Text style={styles.stopAllBtnText}>
                                  All future
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={styles.scheduleActions}>
                          <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => {
                              setSkippingId(schedule.id);
                              setConfirmStopAll(false);
                            }}>
                            <Text style={styles.skipBtnText}>Skip</Text>
                          </TouchableOpacity>
                          {isAdHoc ? (
                            <TouchableOpacity
                              style={styles.markDoneBtn}
                              onPress={() => {
                                // Ad-hoc: just dismiss — nothing to log
                                onSkipInstance(schedule.id);
                                setSkippedIds(prev => new Set(prev).add(schedule.id));
                              }}>
                              <Text style={styles.markDoneBtnText}>
                                Done
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.markDoneBtn}
                              onPress={() => {
                                setCommentingId(schedule.id);
                                setCommentText('');
                              }}>
                              <Text style={styles.markDoneBtnText}>
                                Mark Done
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Activity logs */}
            {logs.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>
                  {'\u{2705}'} Logged
                </Text>
                {logs.map(log => {
                  const act = activitiesMap[log.activityId];
                  return (
                    <View key={log.id} style={styles.logItem}>
                      <View
                        style={[
                          styles.colorBar,
                          {backgroundColor: act?.color || theme.colors.textMuted},
                        ]}
                      />
                      <View style={styles.logInfo}>
                        <Text style={styles.logText}>
                          {act?.name || 'Unknown'}
                        </Text>
                        {log.comment ? (
                          <Text style={styles.logComment}>{log.comment}</Text>
                        ) : null}
                        {log.logTime ? (
                          <Text style={styles.logMeta}>{log.logTime}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {scheduledItems.length === 0 && logs.length === 0 && (
              <View style={styles.emptySheet}>
                <Text style={styles.emptyEmoji}>{'\u{1F4AD}'}</Text>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyText}>
                  Log or schedule an activity for this day
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.sheetActionBtn}
              onPress={onLogActivity}
              activeOpacity={0.7}>
              <Text style={styles.sheetActionIcon}>{'\u{270F}\u{FE0F}'}</Text>
              <Text style={styles.sheetActionLabel}>Log Activity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetActionBtnAlt, isPastDate && styles.sheetActionDisabled]}
              onPress={onScheduleActivity}
              activeOpacity={0.7}
              disabled={isPastDate}>
              <Text style={styles.sheetActionIcon}>{'\u{1F4C5}'}</Text>
              <Text style={[styles.sheetActionLabelAlt, isPastDate && styles.sheetActionLabelDisabled]}>
                Schedule
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
