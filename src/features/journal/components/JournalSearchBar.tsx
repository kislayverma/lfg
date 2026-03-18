import React, {useState, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';

import {useSearchPages} from '../hooks/useJournalPage';
import type {SearchResult} from '../hooks/useJournalPage';
import {useTheme, spacing, radius} from '../../../theme';
import type {Theme} from '../../../theme/types';

interface JournalSearchBarProps {
  onSelectPage: (title: string, pageType: 'daily' | 'page') => void;
  onOpenPages: () => void;
}

export default function JournalSearchBar({
  onSelectPage,
  onOpenPages,
}: JournalSearchBarProps) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const {results, isSearching, hasQuery} = useSearchPages(query);

  const showDropdown = isFocused && hasQuery;

  const handleSelect = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss();
      setQuery('');
      setIsFocused(false);
      onSelectPage(result.page.title, result.page.pageType as 'daily' | 'page');
    },
    [onSelectPage],
  );

  const handleBlur = useCallback(() => {
    // Small delay so onPress on dropdown items fires before blur hides them
    setTimeout(() => {
      setIsFocused(false);
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.blur();
    setIsFocused(false);
  }, []);

  const renderResult = useCallback(
    ({item}: {item: SearchResult}) => {
      const isDaily = item.page.pageType === 'daily';
      const icon = isDaily ? '\u{1F4C5}' : '\u{1F4C4}';
      const displayTitle = isDaily
        ? formatDailyTitle(item.page.title)
        : item.page.title;

      return (
        <TouchableOpacity
          style={styles.resultItem}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}>
          <Text style={styles.resultIcon}>{icon}</Text>
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {displayTitle}
            </Text>
            {item.snippet && item.matchType !== 'title' && (
              <Text style={styles.resultSnippet} numberOfLines={1}>
                {item.snippet}
              </Text>
            )}
          </View>
          <Text style={styles.matchBadge}>
            {item.matchType === 'title'
              ? 'title'
              : item.matchType === 'both'
                ? 'title+body'
                : 'body'}
          </Text>
        </TouchableOpacity>
      );
    },
    [styles, handleSelect],
  );

  return (
    <View style={styles.container}>
      {/* Search input row */}
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search pages..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {hasQuery && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Text style={styles.clearIcon}>{'\u{2715}'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={onOpenPages}
          activeOpacity={0.7}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <Text style={styles.pagesLink}>All</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown results */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {isSearching ? (
            <View style={styles.dropdownMessage}>
              <Text style={styles.dropdownMessageText}>Searching...</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.dropdownMessage}>
              <Text style={styles.dropdownMessageText}>No results found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={item => item.page.id}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
    </View>
  );
}

function formatDailyTitle(dateKey: string): string {
  try {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('default', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateKey;
  }
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          zIndex: 10,
        },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        },
        inputWrapper: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          ...theme.glassCard,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          height: 36,
        },
        searchIcon: {
          fontSize: 13,
          marginRight: spacing.xs,
          opacity: 0.6,
        },
        input: {
          flex: 1,
          fontSize: 14,
          color: theme.colors.text,
          paddingVertical: 0,
          height: 36,
        },
        clearIcon: {
          fontSize: 12,
          color: theme.colors.textMuted,
          paddingLeft: spacing.xs,
        },
        pagesLink: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.primary,
        },
        dropdown: {
          position: 'absolute',
          top: 42,
          left: spacing.xl,
          right: spacing.xl,
          maxHeight: 280,
          borderRadius: radius.md,
          backgroundColor: theme.colors.bgLight,
          borderWidth: 1,
          borderColor: theme.colors.borderLight,
          ...theme.shadows.md,
          overflow: 'hidden',
        },
        resultsList: {
          maxHeight: 280,
        },
        resultItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderLight,
        },
        resultIcon: {
          fontSize: 16,
          marginRight: spacing.sm,
        },
        resultContent: {
          flex: 1,
          marginRight: spacing.sm,
        },
        resultTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.text,
        },
        resultSnippet: {
          fontSize: 12,
          color: theme.colors.textMuted,
          marginTop: 1,
        },
        matchBadge: {
          fontSize: 10,
          color: theme.colors.textMuted,
          backgroundColor: theme.colors.primaryPale,
          paddingHorizontal: spacing.xs,
          paddingVertical: 2,
          borderRadius: radius.sm,
          overflow: 'hidden',
        },
        dropdownMessage: {
          paddingVertical: spacing.lg,
          alignItems: 'center',
        },
        dropdownMessageText: {
          fontSize: 13,
          color: theme.colors.textMuted,
        },
      }),
    [theme],
  );
