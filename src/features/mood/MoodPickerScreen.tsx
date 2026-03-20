/**
 * Mood Picker Screen.
 *
 * Shows a scrollable grid of mood options for the selected category.
 * Each option displays the mood label inside a themed card. Tapping one
 * shows a description at the bottom and navigates to the journal screen.
 */

import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme/types';
import {MOOD_CATEGORIES} from './moodData';
import type {MoodCategoryId, MoodItem} from './moodData';

type Nav = NativeStackNavigationProp<any>;
type Route = RouteProp<{MoodPicker: {categoryId: MoodCategoryId}}, 'MoodPicker'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const COLUMNS = 3;
const CIRCLE_MARGIN = 10;
const CIRCLE_SIZE =
  (SCREEN_WIDTH - spacing.xl * 2 - CIRCLE_MARGIN * (COLUMNS - 1) * 2) /
  COLUMNS;

export default function MoodPickerScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const category = MOOD_CATEGORIES.find(
    c => c.id === route.params.categoryId,
  )!;
  const [selectedMood, setSelectedMood] = useState<MoodItem | null>(null);

  const handleMoodPress = useCallback(
    (mood: MoodItem) => {
      setSelectedMood(mood);
    },
    [],
  );

  const handleContinue = useCallback(() => {
    if (selectedMood) {
      navigation.navigate('MoodJournal', {
        categoryId: category.id,
        moodName: selectedMood.name,
        moodDescription: selectedMood.description,
        categoryColor: category.color,
      });
    }
  }, [navigation, selectedMood, category]);

  // Build rows of COLUMNS moods each
  const rows = useMemo(() => {
    const result: MoodItem[][] = [];
    for (let i = 0; i < category.moods.length; i += COLUMNS) {
      result.push(category.moods.slice(i, i + COLUMNS));
    }
    return result;
  }, [category]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(mood => {
              const isSelected = selectedMood?.name === mood.name;
              return (
                <TouchableOpacity
                  key={mood.name}
                  style={[
                    styles.moodCircle,
                    theme.glassCard,
                    isSelected && styles.moodCircleSelected,
                    isSelected && {
                      borderColor: category.color,
                      backgroundColor: category.color,
                    },
                  ]}
                  onPress={() => handleMoodPress(mood)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.moodLabel,
                      isSelected && styles.moodLabelSelected,
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit>
                    {mood.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Fill empty spots in last row */}
            {row.length < COLUMNS &&
              Array.from({length: COLUMNS - row.length}).map((_, i) => (
                <View key={`empty-${i}`} style={styles.moodCirclePlaceholder} />
              ))}
          </View>
        ))}
      </ScrollView>

      {/* Bottom panel showing selected mood description */}
      {selectedMood && (
        <View style={[styles.bottomPanel, theme.glassCard]}>
          <View style={styles.bottomPanelContent}>
            <View style={styles.bottomTextContainer}>
              <Text style={[styles.bottomMoodName, {color: category.color}]}>
                {selectedMood.name}
              </Text>
              <Text style={styles.bottomDescription}>
                {selectedMood.description}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.continueButton, {backgroundColor: category.color}]}
              onPress={handleContinue}
              activeOpacity={0.8}>
              <Text style={styles.continueArrow}>{'\u{2192}'}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: 120,
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: CIRCLE_MARGIN * 2,
          gap: CIRCLE_MARGIN * 2,
        },
        moodCircle: {
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        moodCircleSelected: {
          borderWidth: 3,
          transform: [{scale: 1.08}],
          ...theme.shadows.md,
        },
        moodCirclePlaceholder: {
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
        },
        moodLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.text,
          textAlign: 'center',
          paddingHorizontal: 6,
        },
        moodLabelSelected: {
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
        bottomPanel: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
        },
        bottomPanelContent: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        bottomTextContainer: {
          flex: 1,
          marginRight: spacing.lg,
        },
        bottomMoodName: {
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 4,
        },
        bottomDescription: {
          fontSize: 14,
          color: theme.colors.textMuted,
          lineHeight: 20,
        },
        continueButton: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
        },
        continueArrow: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
          lineHeight: 24,
          textAlign: 'center',
          includeFontPadding: false,
        },
      }),
    [theme],
  );
