import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useActivities, useActivitySearch} from '../../hooks/useActivities';
import {relativeTime} from '../../utils/date';
import StreakBadge from '../../components/StreakBadge';
import {useTheme, spacing, radius, emptyStates} from '../../theme';
import type {Theme} from '../../theme';
import type {ActivitiesStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'ActivitiesList'>;

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        // Search
        searchContainer: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.bgLight,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
        },
        searchIcon: {
          fontSize: 14,
          marginRight: spacing.sm,
          color: theme.colors.textMuted,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          fontSize: 15,
          color: theme.colors.text,
        },
        countLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textMuted,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        // List
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: 40,
        },
        // Card
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          ...theme.glassCard,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        },
        colorDot: {
          width: 14,
          height: 14,
          borderRadius: 7,
          marginRight: spacing.md,
        },
        cardContent: {
          flex: 1,
        },
        activityName: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.xs,
          gap: spacing.sm,
        },
        lastLogged: {
          fontSize: 12,
          color: theme.colors.textMuted,
        },
        chevronText: {
          fontSize: 22,
          color: theme.colors.textMuted,
          fontWeight: '300',
          marginLeft: spacing.sm,
        },
        // Empty
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

export default function ActivitiesScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const allActivities = useActivities();
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useActivitySearch(searchQuery);

  const displayList = searchQuery.trim() ? searchResults : allActivities;

  const renderItem = useCallback(
    ({item, index}: {item: (typeof allActivities)[0]; index: number}) => (
      <ActivityCard
        activity={item}
        index={index}
        onPress={() =>
          navigation.navigate('ActivityDetail', {activityId: item.id})
        }
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback(
    (item: (typeof allActivities)[0]) => item.id,
    [],
  );

  const isEmpty = searchQuery.trim()
    ? emptyStates.searchEmpty
    : emptyStates.noActivities;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your activities..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {displayList.length > 0 && (
        <Text style={styles.countLabel}>
          {displayList.length} activit{displayList.length === 1 ? 'y' : 'ies'}
        </Text>
      )}

      <FlatList
        data={displayList}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
              {searchQuery.trim() ? '\u{1F50E}' : '\u{1F680}'}
            </Text>
            <Text style={styles.emptyTitle}>{isEmpty.title}</Text>
            <Text style={styles.emptySubtitle}>{isEmpty.subtitle}</Text>
          </View>
        }
      />
    </View>
  );
}

function ActivityCard({
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
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{translateY: slideAnim}],
      }}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={onPress}>
        <View style={[styles.colorDot, {backgroundColor: activity.color}]} />
        <View style={styles.cardContent}>
          <Text style={styles.activityName} numberOfLines={1}>
            {activity.name}
          </Text>
          <View style={styles.metaRow}>
            {activity.currentStreak > 0 && (
              <StreakBadge streak={activity.currentStreak} size="sm" animate={false} />
            )}
            {activity.lastLoggedAt && (
              <Text style={styles.lastLogged}>
                {relativeTime(activity.lastLoggedAt)}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.chevronText}>{'\u{203A}'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
