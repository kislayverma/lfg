import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useBacklinks} from '../hooks/useJournalPage';
import {useTheme, spacing, radius} from '../../../theme';
import type {Theme} from '../../../theme/types';

interface BacklinksSectionProps {
  titleNormalized: string;
  onNavigateToPage: (title: string) => void;
}

export default function BacklinksSection({
  titleNormalized,
  onNavigateToPage,
}: BacklinksSectionProps) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const backlinks = useBacklinks(titleNormalized);

  if (backlinks.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Linked mentions</Text>
      {backlinks.map(page => (
        <TouchableOpacity
          key={page.id}
          style={styles.item}
          onPress={() => onNavigateToPage(page.title)}
          activeOpacity={0.7}>
          <Text style={styles.pageIcon}>
            {page.pageType === 'daily' ? '\u{1F4C5}' : '\u{1F4C4}'}
          </Text>
          <View style={styles.itemContent}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {page.title}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {page.content.slice(0, 80)}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginTop: spacing.xxl,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderLight,
        },
        heading: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.md,
        },
        item: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.sm,
          ...theme.glassCard,
          marginBottom: spacing.xs,
        },
        pageIcon: {
          fontSize: 16,
          marginRight: spacing.md,
        },
        itemContent: {
          flex: 1,
        },
        pageTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.text,
        },
        preview: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginTop: 1,
        },
      }),
    [theme],
  );
