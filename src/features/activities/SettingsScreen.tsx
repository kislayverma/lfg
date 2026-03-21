import React, {useCallback, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {database, Activity, ActivityLog, Schedule} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {recalculateAllStreaks} from '../../services/streakEngine';
import {
  requestNotificationPermission,
  cancelRemindersForSchedule,
  replenishAllReminders,
} from '../../services/notifications';
import {cancelAllNudges} from '../../services/nudgeScheduler';
import {useUIStore} from '../../stores/uiStore';
import {useAuthStore} from '../../stores/authStore';
import {usePreferencesStore} from '../../stores/preferencesStore';
import {useTheme, themes, spacing, radius} from '../../theme';
import type {Theme, ThemeId} from '../../theme';
import {useThemeStore} from '../../stores/themeStore';

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

type Nav = NativeStackNavigationProp<any>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const showToast = useUIStore(s => s.showToast);
  const {currentUser, logout} = useAuthStore();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const theme = useTheme();
  const {themeId, setThemeId} = useThemeStore();
  const {
    calendarSyncEnabled,
    setCalendarSyncEnabled,
    notificationsEnabled,
    setNotificationsEnabled,
    defaultReminderMinutes,
    setDefaultReminderMinutes,
    celebrationNotificationsEnabled,
    setCelebrationNotificationsEnabled,
    smartNudgesEnabled,
    setSmartNudgesEnabled,
  } = usePreferencesStore();
  const styles = useStyles(theme);

  const handleRecalculateStreaks = useCallback(async () => {
    setIsRecalculating(true);
    try {
      await recalculateAllStreaks();
      showToast('All streaks recalculated!');
    } catch (error) {
      console.error('Error recalculating streaks:', error);
    } finally {
      setIsRecalculating(false);
    }
  }, [showToast]);

  const handleToggleNotifications = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          showToast('Notification permission denied');
          return;
        }
        setNotificationsEnabled(true);
        // Reschedule all reminders
        try {
          await replenishAllReminders();
        } catch (error) {
          console.error('Error replenishing reminders:', error);
        }
        showToast('Notifications enabled');
      } else {
        setNotificationsEnabled(false);
        // Cancel all pending reminders
        const userId = currentUser?.id;
        if (userId) {
          try {
            const schedules = await database
              .get<Schedule>('schedules')
              .query(
                Q.where('user_id', userId),
                Q.where('is_active', true),
              )
              .fetch();
            for (const s of schedules) {
              await cancelRemindersForSchedule(s.id);
            }
          } catch (error) {
            console.error('Error cancelling reminders:', error);
          }
        }
        showToast('Notifications disabled');
      }
    },
    [setNotificationsEnabled, showToast, currentUser],
  );

  const handleToggleCalendarSync = useCallback(
    (enabled: boolean) => {
      setCalendarSyncEnabled(enabled);
      showToast(
        enabled
          ? 'New schedules will sync to your calendar'
          : 'Calendar sync disabled',
      );
    },
    [setCalendarSyncEnabled, showToast],
  );

  const handleToggleCelebrations = useCallback(
    (enabled: boolean) => {
      setCelebrationNotificationsEnabled(enabled);
      showToast(
        enabled ? 'Celebration notifications on' : 'Celebration notifications off',
      );
    },
    [setCelebrationNotificationsEnabled, showToast],
  );

  const handleToggleSmartNudges = useCallback(
    async (enabled: boolean) => {
      setSmartNudgesEnabled(enabled);
      if (!enabled) {
        try {
          await cancelAllNudges();
        } catch (error) {
          console.error('Error cancelling nudges:', error);
        }
      }
      showToast(
        enabled ? 'Smart nudges enabled' : 'Smart nudges disabled',
      );
    },
    [setSmartNudgesEnabled, showToast],
  );

  const handleChangeReminderMinutes = useCallback(
    (minutes: number) => {
      setDefaultReminderMinutes(minutes);
      showToast(`Default reminder set to ${minutes} min`);
    },
    [setDefaultReminderMinutes, showToast],
  );

  const handleResetAllData = useCallback(() => {
    const userId = currentUser?.id;
    if (!userId) {
      return;
    }

    Alert.alert(
      'Reset All Data',
      'This will permanently delete all your activities, logs, and schedules. Your account will remain. This cannot be undone. Are you sure?',
      [
        {text: 'Keep My Data', style: 'cancel'},
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const activities = await database
                .get<Activity>('activities')
                .query(Q.where('user_id', userId))
                .fetch();
              const logs = await database
                .get<ActivityLog>('activity_logs')
                .query(Q.where('user_id', userId))
                .fetch();
              const schedules = await database
                .get<Schedule>('schedules')
                .query(Q.where('user_id', userId))
                .fetch();

              await database.write(async () => {
                await database.batch(
                  ...logs.map(l => l.prepareDestroyPermanently()),
                  ...schedules.map(s => s.prepareDestroyPermanently()),
                  ...activities.map(a => a.prepareDestroyPermanently()),
                );
              });

              showToast('All data cleared');
            } catch (error) {
              console.error('Error resetting data:', error);
            }
          },
        },
      ],
    );
  }, [showToast, currentUser]);

  const handleExportData = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId) {
      return;
    }

    try {
      const activities = await database
        .get<Activity>('activities')
        .query(Q.where('user_id', userId))
        .fetch();
      const logs = await database
        .get<ActivityLog>('activity_logs')
        .query(Q.where('user_id', userId))
        .fetch();
      const schedules = await database
        .get<Schedule>('schedules')
        .query(Q.where('user_id', userId))
        .fetch();

      const summary = `${activities.length} activities, ${logs.length} logs, ${schedules.length} schedules`;
      showToast(`Your data: ${summary}`);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  }, [showToast, currentUser]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your data stays safe on this device.',
      [
        {text: 'Stay', style: 'cancel'},
        {
          text: 'Log Out',
          onPress: () => {
            logout();
          },
        },
      ],
    );
  }, [logout]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Profile section */}
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.section}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{currentUser?.name}</Text>
              <Text style={styles.profilePhone}>{currentUser?.phone}</Text>
            </View>
          </View>
        </View>

        {/* Activities */}
        <Text style={styles.sectionTitle}>Activities</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ActivitiesList')}
            activeOpacity={0.7}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{2705}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Manage Activities</Text>
              <Text style={styles.rowSubtitle}>
                View, create, and edit your activities
              </Text>
            </View>
            <Text style={styles.rowAction}>{'\u{203A}'}</Text>
          </TouchableOpacity>
        </View>

        {/* Theme section */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.section}>
          {(Object.keys(themes) as ThemeId[]).map((id, idx, arr) => (
            <React.Fragment key={id}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => setThemeId(id)}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.themePreview,
                    {backgroundColor: themes[id].colors.bg},
                  ]}>
                  <View
                    style={[
                      styles.themePreviewDot,
                      {backgroundColor: themes[id].colors.primary},
                    ]}
                  />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{themes[id].name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {themes[id].description}
                  </Text>
                </View>
                {themeId === id && (
                  <Text style={styles.themeCheck}>{'\u{2713}'}</Text>
                )}
              </TouchableOpacity>
              {idx < arr.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Notifications section */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F514}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Activity Reminders</Text>
              <Text style={styles.rowSubtitle}>
                Get notified before scheduled activities
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryPale,
              }}
              thumbColor={
                notificationsEnabled
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{23F0}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Default Reminder</Text>
              <Text style={styles.rowSubtitle}>
                How early to remind you before an activity
              </Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            {REMINDER_OPTIONS.map(mins => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.chip,
                  defaultReminderMinutes === mins && styles.chipSelected,
                ]}
                onPress={() => handleChangeReminderMinutes(mins)}
                activeOpacity={0.7}
                disabled={!notificationsEnabled}>
                <Text
                  style={[
                    styles.chipText,
                    defaultReminderMinutes === mins && styles.chipTextSelected,
                    !notificationsEnabled && styles.chipTextDisabled,
                  ]}>
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F389}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Streak Celebrations</Text>
              <Text style={styles.rowSubtitle}>
                Notify on streak milestones
              </Text>
            </View>
            <Switch
              value={celebrationNotificationsEnabled}
              onValueChange={handleToggleCelebrations}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryPale,
              }}
              thumbColor={
                celebrationNotificationsEnabled
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F9E0}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Smart Nudges</Text>
              <Text style={styles.rowSubtitle}>
                Learns your patterns and gently reminds you
              </Text>
            </View>
            <Switch
              value={smartNudgesEnabled}
              onValueChange={handleToggleSmartNudges}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryPale,
              }}
              thumbColor={
                smartNudgesEnabled
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
          </View>
        </View>

        {/* Calendar section */}
        <Text style={styles.sectionTitle}>Calendar</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F4C5}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Sync to Device Calendar</Text>
              <Text style={styles.rowSubtitle}>
                {`Add scheduled activities to the LFG \u{1F680} calendar`}
              </Text>
            </View>
            <Switch
              value={calendarSyncEnabled}
              onValueChange={handleToggleCalendarSync}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryPale,
              }}
              thumbColor={
                calendarSyncEnabled
                  ? theme.colors.primary
                  : theme.colors.textMuted
              }
            />
          </View>
        </View>

        {/* Data section */}
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleRecalculateStreaks}
            disabled={isRecalculating}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F504}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Recalculate Streaks</Text>
              <Text style={styles.rowSubtitle}>
                Recompute all streak counts from your history
              </Text>
            </View>
            <Text style={styles.rowAction}>
              {isRecalculating ? '...' : 'Run'}
            </Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.row} onPress={handleExportData}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F4CA}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Data Summary</Text>
              <Text style={styles.rowSubtitle}>
                See what you've been tracking
              </Text>
            </View>
            <Text style={styles.rowAction}>View</Text>
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{1F6AA}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Log Out</Text>
              <Text style={styles.rowSubtitle}>
                Your data stays safe on this device
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={[styles.section, styles.dangerSection]}>
          <TouchableOpacity style={styles.row} onPress={handleResetAllData}>
            <View style={styles.rowIconContainer}>
              <Text style={styles.rowIcon}>{'\u{26A0}\u{FE0F}'}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, styles.dangerText]}>
                Reset All Data
              </Text>
              <Text style={styles.rowSubtitle}>
                Delete all activities, logs, and schedules
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          All data is stored locally on your device.
          {'\n'}{`LFG \u{1F680} v1.0.0`}
        </Text>
      </ScrollView>
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
        scrollContent: {
          padding: spacing.xl,
          paddingBottom: 60,
        },
        screenTitle: {
          fontSize: 28,
          fontWeight: '800',
          color: theme.colors.text,
          marginBottom: spacing.xxl,
          letterSpacing: -0.5,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.xs,
          marginTop: spacing.xl,
          marginLeft: spacing.xs,
        },
        section: {
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.lg,
          overflow: 'hidden',
        },
        dangerSection: {
          borderWidth: 1,
          borderColor: theme.colors.dangerPale,
        },
        // Profile
        profileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
        },
        profileAvatar: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.lg,
          ...theme.shadows.glow,
        },
        profileInitial: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
        profileInfo: {
          flex: 1,
        },
        profileName: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.colors.text,
        },
        profilePhone: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          marginTop: 2,
        },
        // Rows
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        rowIconContainer: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.cardAlt,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        rowIcon: {
          fontSize: 16,
        },
        rowContent: {
          flex: 1,
        },
        rowTitle: {
          fontSize: 16,
          fontWeight: '500',
          color: theme.colors.text,
        },
        rowSubtitle: {
          fontSize: 13,
          color: theme.colors.textMuted,
          marginTop: 2,
        },
        rowAction: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.primary,
          marginLeft: spacing.sm,
        },
        rowDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
          marginLeft: 64,
        },
        dangerText: {
          color: theme.colors.danger,
        },
        // Chip selector (reminder minutes)
        chipRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          gap: spacing.xs,
        },
        chip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.cardAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chipSelected: {
          backgroundColor: theme.colors.primaryPale,
          borderColor: theme.colors.primary,
        },
        chipText: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
        chipTextSelected: {
          color: theme.colors.primary,
        },
        chipTextDisabled: {
          opacity: 0.4,
        },
        // Theme picker
        themePreview: {
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        themePreviewDot: {
          width: 14,
          height: 14,
          borderRadius: 7,
        },
        themeCheck: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.primary,
          marginLeft: spacing.sm,
        },
        footer: {
          textAlign: 'center',
          color: theme.colors.textMuted,
          fontSize: 12,
          marginTop: spacing.xxxl,
          lineHeight: 18,
        },
      }),
    [theme],
  );
