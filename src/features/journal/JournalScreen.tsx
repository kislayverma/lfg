import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import ScreenWrapper from '../../components/ScreenWrapper';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {database, JournalPage} from '../../database';
import {Q} from '@nozbe/watermelondb';
import {useJournalPage} from './hooks/useJournalPage';
import CalendarStrip from './components/CalendarStrip';
import JournalSearchBar from './components/JournalSearchBar';
import MarkdownRenderer from './components/MarkdownRenderer';
import BacklinksSection from './components/BacklinksSection';
import {useAuthStore} from '../../stores/authStore';
import {useTheme, spacing, radius, typography} from '../../theme';
import type {Theme} from '../../theme/types';
import type {JournalStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<JournalStackParamList>;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function JournalScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [quickText, setQuickText] = useState('');
  const [datesWithContent, setDatesWithContent] = useState<Set<string>>(
    new Set(),
  );

  const {page, content, setContent, isLoading} = useJournalPage(
    selectedDate,
    'daily',
  );

  // Load dates that have content for the calendar strip dots
  useEffect(() => {
    if (!userId) {
      return;
    }

    const collection = database.get<JournalPage>('journal_pages');
    const sub = collection
      .query(
        Q.where('user_id', userId),
        Q.where('page_type', 'daily'),
      )
      .observe()
      .subscribe(pages => {
        const dates = new Set<string>();
        for (const p of pages) {
          if (p.content.trim().length > 0) {
            dates.add(p.title);
          }
        }
        setDatesWithContent(dates);
      });

    return () => sub.unsubscribe();
  }, [userId]);

  const handleQuickCapture = useCallback(() => {
    const trimmed = quickText.trim();
    if (!trimmed || !page) {
      return;
    }

    Keyboard.dismiss();

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry = `${time} \u{2014} ${trimmed}`;
    const newContent = content.length > 0 ? `${content}\n${entry}` : entry;

    setContent(newContent);
    setQuickText('');
  }, [quickText, content, setContent, page]);

  const handleOpenEditor = useCallback(() => {
    navigation.navigate('PageEditor', {
      title: selectedDate,
      pageType: 'daily',
    });
  }, [navigation, selectedDate]);

  const handleLinkPress = useCallback(
    (linkTitle: string) => {
      navigation.navigate('PageEditor', {title: linkTitle, pageType: 'page'});
    },
    [navigation],
  );

  const handleOpenPages = useCallback(() => {
    navigation.navigate('PageList');
  }, [navigation]);

  const handleSearchSelect = useCallback(
    (title: string, pageType: 'daily' | 'page') => {
      if (pageType === 'daily') {
        // Switch the calendar strip to that date
        setSelectedDate(title);
      } else {
        navigation.navigate('PageEditor', {title, pageType: 'page'});
      }
    },
    [navigation],
  );

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const today = todayKey();
    if (selectedDate === today) {
      return 'Today';
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (selectedDate === yKey) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('default', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDate]);

  return (
    <ScreenWrapper>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Notes</Text>
      </View>

      {/* Search bar */}
      <JournalSearchBar
        onSelectPage={handleSearchSelect}
        onOpenPages={handleOpenPages}
      />

      {/* Calendar strip */}
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        datesWithContent={datesWithContent}
      />

      {/* Quick capture */}
      <View style={styles.quickCapture}>
        <TextInput
          style={styles.quickInput}
          placeholder="Quick thought..."
          placeholderTextColor={theme.colors.textMuted}
          value={quickText}
          onChangeText={setQuickText}
          onSubmitEditing={handleQuickCapture}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {quickText.trim().length > 0 && (
          <TouchableOpacity
            style={styles.quickSend}
            onPress={handleQuickCapture}
            activeOpacity={0.7}>
            <Text style={styles.quickSendText}>{'\u{2191}'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily page content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.dayHeader}>
          <Text style={styles.dayLabel}>{dateLabel}</Text>
          <TouchableOpacity onPress={handleOpenEditor} activeOpacity={0.7}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : content.length > 0 ? (
          <>
            <MarkdownRenderer
              content={content}
              onLinkPress={handleLinkPress}
            />
            <BacklinksSection
              titleNormalized={selectedDate.toLowerCase()}
              onNavigateToPage={(linkTitle, linkPageType) =>
                navigation.navigate('PageEditor', {
                  title: linkTitle,
                  pageType: linkPageType,
                  mode: 'preview',
                })
              }
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F4DD}'}</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>
              Type a quick thought above or tap Edit to write freely.
            </Text>
          </View>
        )}
      </ScrollView>
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
        quickCapture: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: spacing.xl,
          marginTop: spacing.sm,
          marginBottom: spacing.md,
          borderRadius: radius.full,
          ...theme.glassCard,
          paddingLeft: spacing.lg,
          paddingRight: spacing.xs,
        },
        quickInput: {
          flex: 1,
          fontSize: 15,
          color: theme.colors.text,
          paddingVertical: 10,
        },
        quickSend: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        quickSendText: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
        contentScroll: {
          flex: 1,
        },
        contentContainer: {
          paddingHorizontal: spacing.xl,
          paddingBottom: 40,
        },
        dayHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.lg,
        },
        dayLabel: {
          ...typography.heading,
          color: theme.colors.text,
        },
        editButton: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.colors.primary,
        },
        loadingText: {
          fontSize: 15,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: spacing.xxxl,
        },
        emptyState: {
          alignItems: 'center',
          paddingTop: spacing.xxxl * 2,
        },
        emptyIcon: {
          fontSize: 40,
          marginBottom: spacing.lg,
        },
        emptyTitle: {
          ...typography.heading,
          color: theme.colors.text,
          marginBottom: spacing.sm,
        },
        emptySubtitle: {
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          lineHeight: 20,
          paddingHorizontal: spacing.xxxl,
        },
      }),
    [theme],
  );
