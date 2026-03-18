import React, {useRef, useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import {useTheme, spacing, radius} from '../../../theme';
import type {Theme} from '../../../theme/types';

interface CalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateKey: string) => void;
  datesWithContent?: Set<string>; // dates that have journal entries
}

const DAY_CELL_WIDTH = 52;
const DAY_MARGIN = 2; // marginHorizontal on each side
const DAY_WIDTH = DAY_CELL_WIDTH + DAY_MARGIN * 2;
const DAYS_BEFORE = 60;
const DAYS_AFTER = 30;

function generateDates(): {key: string; date: Date}[] {
  const dates: {key: string; date: Date}[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = formatKey(d);
    dates.push({key, date: d});
  }

  return dates;
}

function formatKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarStrip({
  selectedDate,
  onSelectDate,
  datesWithContent,
}: CalendarStripProps) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const flatListRef = useRef<FlatList>(null);

  const dates = useMemo(() => generateDates(), []);
  const todayKey = useMemo(() => formatKey(new Date()), []);

  // Scroll to selected date on mount
  useEffect(() => {
    const idx = dates.findIndex(d => d.key === selectedDate);
    if (idx >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: false,
          viewPosition: 0.5,
        });
      }, 100);
    }
  }, []);

  const renderItem = useCallback(
    ({item}: {item: {key: string; date: Date}}) => {
      const isSelected = item.key === selectedDate;
      const isToday = item.key === todayKey;
      const hasContent = datesWithContent?.has(item.key);

      return (
        <TouchableOpacity
          style={[
            styles.dayCell,
            isSelected && styles.dayCellSelected,
            isToday && !isSelected && styles.dayCellToday,
          ]}
          onPress={() => onSelectDate(item.key)}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.dayName,
              isSelected && styles.dayNameSelected,
            ]}>
            {WEEKDAYS[item.date.getDay()]}
          </Text>
          <Text
            style={[
              styles.dayNumber,
              isSelected && styles.dayNumberSelected,
              isToday && !isSelected && styles.dayNumberToday,
            ]}>
            {item.date.getDate()}
          </Text>
          {hasContent && !isSelected && <View style={styles.contentDot} />}
        </TouchableOpacity>
      );
    },
    [selectedDate, todayKey, datesWithContent, styles, onSelectDate],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: DAY_WIDTH,
      offset: DAY_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <FlatList
      ref={flatListRef}
      data={dates}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      getItemLayout={getItemLayout}
      style={styles.container}
      contentContainerStyle={styles.listContent}
      onScrollToIndexFailed={() => {}}
    />
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          maxHeight: 80,
        },
        listContent: {
          paddingHorizontal: spacing.sm,
        },
        dayCell: {
          width: DAY_CELL_WIDTH,
          height: 68,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          marginHorizontal: 2,
        },
        dayCellSelected: {
          backgroundColor: theme.colors.primary,
        },
        dayCellToday: {
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        dayName: {
          fontSize: 11,
          fontWeight: '500',
          color: theme.colors.textMuted,
          marginBottom: 2,
        },
        dayNameSelected: {
          color: theme.colors.textOnPrimary,
        },
        dayNumber: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
        },
        dayNumberSelected: {
          color: theme.colors.textOnPrimary,
        },
        dayNumberToday: {
          color: theme.colors.primary,
        },
        contentDot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.primary,
          marginTop: 3,
        },
      }),
    [theme],
  );
