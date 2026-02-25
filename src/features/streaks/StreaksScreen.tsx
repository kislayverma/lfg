import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useActivities} from '../../hooks/useActivities';
import {recalculateAllStreaks} from '../../services/streakEngine';
import {useUIStore} from '../../stores/uiStore';
import StreakBadge from '../../components/StreakBadge';
import {useTheme, spacing, radius, emptyStates} from '../../theme';
import type {Theme} from '../../theme';
import type {StreaksStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<StreaksStackParamList>;

type SortMode = 'current' | 'longest' | 'name';

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        // Hero
        heroHeader: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        },
        heroTitle: {
          fontSize: 28,
          fontWeight: '800',
          color: theme.colors.text,
          letterSpacing: -0.5,
        },
        heroSubtitle: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          marginTop: spacing.xs,
        },
        // Summary
        summaryRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          gap: 10,
        },
        summaryCard: {
          flex: 1,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.lg,
          paddingVertical: 14,
          alignItems: 'center',
        },
        summaryCardHighlight: {
          backgroundColor: theme.colors.primaryPale,
          borderColor: theme.colors.primary,
        },
        summaryEmoji: {
          fontSize: 20,
          marginBottom: spacing.xs,
        },
        summaryValue: {
          fontSize: 26,
          fontWeight: '800',
          color: theme.colors.text,
        },
        summaryValueHighlight: {
          color: theme.colors.primary,
        },
        summaryLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: theme.colors.textMuted,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        // Sort tabs
        sortRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        sortTab: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        },
        sortTabActive: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        sortTabText: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.textMuted,
        },
        sortTabTextActive: {
          color: theme.colors.textOnPrimary,
        },
        // List
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        },
        gridRow: {
          gap: spacing.md,
        },
        // Card
        cardWrapper: {
          flex: 1,
          maxWidth: '50%',
        },
        card: {
          aspectRatio: 1,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.lg,
          marginBottom: spacing.md,
          padding: 14,
          justifyContent: 'space-between',
          overflow: 'hidden',
        },
        cardInactive: {
          opacity: 0.5,
        },
        colorDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
        },
        activityName: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.text,
          marginTop: spacing.sm,
        },
        badgeArea: {
          alignItems: 'center',
          paddingVertical: spacing.xs,
        },
        levelLabel: {
          fontSize: 11,
          fontWeight: '600',
          textAlign: 'center',
        },
        streakRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        },
        streakItem: {
          alignItems: 'center',
          minWidth: 36,
        },
        streakNumber: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.textSecondary,
        },
        streakLabel: {
          fontSize: 9,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginTop: 1,
        },
        streakDivider: {
          width: 1,
          height: 24,
          backgroundColor: theme.colors.border,
          marginHorizontal: spacing.sm,
        },
        // Empty state
        emptyContainer: {
          alignItems: 'center',
          paddingTop: 80,
        },
        emptyEmoji: {
          fontSize: 48,
          marginBottom: spacing.md,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: spacing.xs,
        },
        emptySubtitle: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          paddingHorizontal: 40,
          lineHeight: 20,
        },
      }),
    [theme],
  );

export default function StreaksScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const activities = useActivities();
  const showToast = useUIStore(s => s.showToast);
  const [sortMode, setSortMode] = React.useState<SortMode>('current');
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    recalculateAllStreaks().catch(console.error);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await recalculateAllStreaks();
      showToast('Streaks refreshed!');
    } catch (error) {
      console.error('Failed to recalculate streaks:', error);
    } finally {
      setRefreshing(false);
    }
  }, [showToast]);

  const sortedActivities = useMemo(() => {
    const list = [...activities];
    switch (sortMode) {
      case 'current':
        list.sort((a, b) => b.currentStreak - a.currentStreak);
        break;
      case 'longest':
        list.sort((a, b) => b.longestStreak - a.longestStreak);
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [activities, sortMode]);

  const totalActive = useMemo(
    () => activities.filter(a => a.currentStreak > 0).length,
    [activities],
  );
  const bestStreak = useMemo(
    () => activities.reduce((max, a) => Math.max(max, a.longestStreak), 0),
    [activities],
  );

  const navigation = useNavigation<Nav>();

  const handleStreakPress = useCallback(
    (activityId: string) => {
      navigation.navigate('StreakDetail', {activityId});
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({item, index}: {item: (typeof activities)[0]; index: number}) => (
      <StreakCard
        activity={item}
        index={index}
        onPress={() => handleStreakPress(item.id)}
      />
    ),
    [handleStreakPress],
  );

  const keyExtractor = useCallback(
    (item: (typeof activities)[0]) => item.id,
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Hero header */}
      <View style={styles.heroHeader}>
        <Text style={styles.heroTitle}>Your Streaks</Text>
        <Text style={styles.heroSubtitle}>
          {totalActive > 0
            ? `${totalActive} active streak${totalActive !== 1 ? 's' : ''} going strong!`
            : 'Start logging to build your first streak!'}
        </Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>{'\u{26A1}'}</Text>
          <Text style={styles.summaryValue}>{totalActive}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
          <Text style={styles.summaryEmoji}>{'\u{1F3C6}'}</Text>
          <Text style={[styles.summaryValue, styles.summaryValueHighlight]}>
            {bestStreak}
          </Text>
          <Text style={styles.summaryLabel}>Best Ever</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>{'\u{1F3AF}'}</Text>
          <Text style={styles.summaryValue}>{activities.length}</Text>
          <Text style={styles.summaryLabel}>Activities</Text>
        </View>
      </View>

      {/* Sort tabs */}
      <View style={styles.sortRow}>
        {(['current', 'longest', 'name'] as SortMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.sortTab,
              sortMode === mode && styles.sortTabActive,
            ]}
            onPress={() => setSortMode(mode)}>
            <Text
              style={[
                styles.sortTabText,
                sortMode === mode && styles.sortTabTextActive,
              ]}>
              {mode === 'current'
                ? 'Current'
                : mode === 'longest'
                  ? 'Best'
                  : 'A\u{2013}Z'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity streak grid */}
      <FlatList
        data={sortedActivities}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{'\u{1F331}'}</Text>
            <Text style={styles.emptyTitle}>{emptyStates.noStreaks.title}</Text>
            <Text style={styles.emptySubtitle}>
              {emptyStates.noStreaks.subtitle}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StreakCard({
  activity,
  index,
  onPress,
}: {
  activity: any;
  index: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const {name, color, currentStreak, longestStreak} = activity;
  const isActive = currentStreak > 0;
  const level = theme.getStreakLevel(currentStreak);

  // Staggered entrance animation
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, index]);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: opacityAnim,
          transform: [{translateY: slideAnim}],
        },
      ]}>
      <TouchableOpacity
        style={[styles.card, !isActive && styles.cardInactive]}
        onPress={onPress}
        activeOpacity={0.7}>
        <View style={[styles.colorDot, {backgroundColor: color}]} />
        <Text style={styles.activityName} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.badgeArea}>
          <StreakBadge streak={currentStreak} size="md" />
        </View>

        {isActive && (
          <Text style={[styles.levelLabel, {color: level.color}]}>
            {level.emoji} {level.label}
          </Text>
        )}

        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text
              style={[
                styles.streakNumber,
                isActive && {color: theme.colors.primary},
              ]}>
              {currentStreak}
            </Text>
            <Text style={styles.streakLabel}>current</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakNumber}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>best</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
