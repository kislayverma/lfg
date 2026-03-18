import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useJournalPage} from './hooks/useJournalPage';
import MarkdownRenderer from './components/MarkdownRenderer';
import BacklinksSection from './components/BacklinksSection';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme/types';
import type {JournalStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'PageEditor'>;
type Route = RouteProp<JournalStackParamList, 'PageEditor'>;

export default function PageEditorScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const {title, pageType} = route.params;
  const {page, content, setContent, isLoading, flushSave} = useJournalPage(
    title,
    pageType || 'page',
  );

  const [isEditing, setIsEditing] = useState(true);

  // Save before leaving
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      flushSave();
    });
    return unsubscribe;
  }, [navigation, flushSave]);

  const handleLinkPress = useCallback(
    (linkTitle: string) => {
      flushSave();
      navigation.push('PageEditor', {title: linkTitle, pageType: 'page'});
    },
    [navigation, flushSave],
  );

  const toggleMode = useCallback(() => {
    setIsEditing(prev => !prev);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const displayTitle =
    pageType === 'daily'
      ? new Date(title + 'T00:00:00').toLocaleDateString('default', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : title;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>
        <TouchableOpacity
          style={styles.modeToggle}
          onPress={toggleMode}
          activeOpacity={0.7}>
          <Text style={styles.modeToggleText}>
            {isEditing ? 'Preview' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {isEditing ? (
        <TextInput
          style={[styles.editor, {paddingBottom: Math.max(40, insets.bottom + 16)}]}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          placeholder="Start writing... Use **bold**, # headings, [[links]]"
          placeholderTextColor={theme.colors.textMuted}
          autoFocus={content.length === 0}
          scrollEnabled
        />
      ) : (
        <ScrollView
          style={styles.previewScroll}
          contentContainerStyle={[
            styles.previewContent,
            {paddingBottom: Math.max(40, insets.bottom + 16)},
          ]}>
          {content.length > 0 ? (
            <MarkdownRenderer
              content={content}
              onLinkPress={handleLinkPress}
            />
          ) : (
            <Text style={styles.emptyText}>
              Nothing here yet. Tap Edit to start writing.
            </Text>
          )}

          {/* Backlinks */}
          <BacklinksSection
            titleNormalized={title.toLowerCase()}
            onNavigateToPage={linkTitle => {
              flushSave();
              navigation.push('PageEditor', {
                title: linkTitle,
                pageType: 'page',
              });
            }}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        },
        loadingText: {
          fontSize: 15,
          color: theme.colors.textMuted,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderLight,
        },
        title: {
          flex: 1,
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
          marginRight: spacing.md,
        },
        modeToggle: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: theme.colors.primaryPale,
        },
        modeToggleText: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.primary,
        },
        editor: {
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.text,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        previewScroll: {
          flex: 1,
        },
        previewContent: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
        },
        emptyText: {
          fontSize: 15,
          color: theme.colors.textMuted,
          fontStyle: 'italic',
          textAlign: 'center',
          marginTop: spacing.xxxl,
        },
      }),
    [theme],
  );
