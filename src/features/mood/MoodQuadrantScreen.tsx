/**
 * Mood Category Screen (first screen).
 *
 * Shows five vertically stacked emoji options:
 *   Awesome, Good, Ok, Bad, Awful
 *
 * Tapping a category navigates to MoodPickerScreen with
 * fine-grained moods for that category.
 */

import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme, spacing, typography} from '../../theme';
import type {Theme} from '../../theme/types';
import {MOOD_CATEGORIES} from './moodData';
import type {MoodCategoryId} from './moodData';

type Nav = NativeStackNavigationProp<any>;

export default function MoodQuadrantScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();

  const handleCategoryPress = (categoryId: MoodCategoryId) => {
    navigation.navigate('MoodPicker', {categoryId});
  };

  return (
    <ScreenWrapper>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Mood</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MoodHistory')}
          activeOpacity={0.7}>
          <Text style={styles.historyLink}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.prompt}>How are you feeling?</Text>

        <View style={styles.categoryList}>
          {MOOD_CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryRow, theme.glassCard]}
              onPress={() => handleCategoryPress(category.id)}
              activeOpacity={0.7}>
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              <Text style={styles.categoryLabel}>{category.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        },
        screenTitle: {
          ...typography.title,
          color: theme.colors.text,
        },
        historyLink: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.primary,
        },
        content: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          paddingBottom: 40,
        },
        prompt: {
          ...typography.heading,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: spacing.xxxl,
        },
        categoryList: {
          width: '100%',
          gap: spacing.md,
        },
        categoryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          borderRadius: 16,
        },
        categoryEmoji: {
          fontSize: 36,
          marginRight: spacing.lg,
        },
        categoryLabel: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
        },
      }),
    [theme],
  );
