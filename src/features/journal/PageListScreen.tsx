import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAllPages} from './hooks/useJournalPage';
import type {JournalPage} from '../../database';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme/types';
import type {JournalStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'PageList'>;

export default function PageListScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();

  const [search, setSearch] = useState('');
  const {pages, isLoading} = useAllPages(search);

  const handleOpenPage = useCallback(
    (page: JournalPage) => {
      navigation.navigate('PageEditor', {
        title: page.title,
        pageType: page.pageType,
      });
    },
    [navigation],
  );

  const handleCreatePage = useCallback(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return;
    }
    navigation.navigate('PageEditor', {title: trimmed, pageType: 'page'});
    setSearch('');
  }, [search, navigation]);

  const renderItem = useCallback(
    ({item}: {item: JournalPage}) => {
      const updatedDate = new Date(item.updatedAt);
      const timeLabel = updatedDate.toLocaleDateString('default', {
        month: 'short',
        day: 'numeric',
      });
      const preview = item.content.replace(/[#*_~`\[\]]/g, '').trim();

      return (
        <TouchableOpacity
          style={styles.pageItem}
          onPress={() => handleOpenPage(item)}
          activeOpacity={0.7}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isPinned && <Text style={styles.pinIcon}>{'\u{1F4CC}'}</Text>}
          </View>
          <Text style={styles.pagePreview} numberOfLines={2}>
            {preview || 'Empty page'}
          </Text>
          <Text style={styles.pageDate}>{timeLabel}</Text>
        </TouchableOpacity>
      );
    },
    [styles, handleOpenPage],
  );

  const showCreateButton =
    search.trim().length > 0 &&
    !pages.some(p => p.titleNormalized === search.trim().toLowerCase());

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search or create page..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={showCreateButton ? handleCreatePage : undefined}
        />
      </View>

      {/* Create new page button */}
      {showCreateButton && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreatePage}
          activeOpacity={0.7}>
          <Text style={styles.createButtonText}>
            + Create "{search.trim()}"
          </Text>
        </TouchableOpacity>
      )}

      {/* Pages list */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : pages.length === 0 && !showCreateButton ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u{1F4C4}'}</Text>
          <Text style={styles.emptyTitle}>No pages yet</Text>
          <Text style={styles.emptyText}>
            Pages are created when you type [[page name]] in your journal.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
        searchContainer: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        },
        searchInput: {
          ...theme.glassCard,
          borderRadius: radius.full,
          paddingHorizontal: spacing.lg,
          paddingVertical: 10,
          fontSize: 15,
          color: theme.colors.text,
        },
        createButton: {
          marginHorizontal: spacing.xl,
          marginBottom: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: theme.colors.primaryPale,
          borderWidth: 1,
          borderColor: theme.colors.primaryGlow,
        },
        createButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.primary,
        },
        listContent: {
          paddingHorizontal: spacing.xl,
          paddingBottom: 40,
        },
        pageItem: {
          ...theme.glassCard,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        },
        pageHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        pageTitle: {
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        pinIcon: {
          fontSize: 14,
          marginLeft: spacing.sm,
        },
        pagePreview: {
          fontSize: 13,
          color: theme.colors.textMuted,
          lineHeight: 18,
          marginBottom: spacing.xs,
        },
        pageDate: {
          fontSize: 11,
          color: theme.colors.textMuted,
        },
        emptyContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xxxl,
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: spacing.lg,
        },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: spacing.sm,
        },
        emptyText: {
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [theme],
  );
