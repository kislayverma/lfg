import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';

import {useJournalPage, useBacklinks} from './hooks/useJournalPage';
import {useVoiceInput} from './hooks/useVoiceInput';
import MarkdownRenderer from './components/MarkdownRenderer';
import BacklinksSection from './components/BacklinksSection';
import FormattingToolbar from './components/FormattingToolbar';
import type {FormatAction} from './components/FormattingToolbar';
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

  const {title, pageType, mode} = route.params;
  const {page, content, setContent, isLoading, flushSave, renamePage} =
    useJournalPage(title, pageType || 'page');

  const [isEditing, setIsEditing] = useState(mode !== 'preview');
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({start: 0, end: 0});
  const backlinks = useBacklinks(title.toLowerCase());

  // Voice input — append transcribed text at cursor position
  const handleVoiceResult = useCallback(
    (text: string) => {
      const {start} = selectionRef.current;
      const before = content.slice(0, start);
      const after = content.slice(start);
      // Add a space before if there's already text and it doesn't end with whitespace
      const separator =
        before.length > 0 && !/\s$/.test(before) ? ' ' : '';
      const newContent = before + separator + text + after;
      setContent(newContent);
      // Move cursor to end of inserted text
      const newPos = start + separator.length + text.length;
      setTimeout(() => {
        inputRef.current?.setNativeProps({
          selection: {start: newPos, end: newPos},
        });
      }, 50);
    },
    [content, setContent],
  );

  const {isListening, partialText, toggleListening} = useVoiceInput({
    onResult: handleVoiceResult,
  });

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
    },
    [],
  );

  const handleFormat = useCallback(
    (action: FormatAction) => {
      const {start, end} = selectionRef.current;
      const hasSelection = start !== end;

      if (action.isLinePrefix) {
        // Line-level formats: insert at the start of the current line
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        const before = content.slice(0, lineStart);
        const after = content.slice(lineStart);
        const newContent = before + action.prefix + after;
        setContent(newContent);

        // Move cursor after the inserted prefix
        const newPos = start + action.prefix.length;
        setTimeout(() => {
          inputRef.current?.setNativeProps({
            selection: {start: newPos, end: newPos},
          });
        }, 50);
      } else if (hasSelection) {
        // Wrap the selected text
        const before = content.slice(0, start);
        const selected = content.slice(start, end);
        const after = content.slice(end);
        const newContent =
          before + action.prefix + selected + action.suffix + after;
        setContent(newContent);

        // Select the wrapped text (inside the markers)
        const newStart = start + action.prefix.length;
        const newEnd = newStart + selected.length;
        setTimeout(() => {
          inputRef.current?.setNativeProps({
            selection: {start: newStart, end: newEnd},
          });
        }, 50);
      } else {
        // No selection: insert prefix + placeholder + suffix
        const before = content.slice(0, start);
        const after = content.slice(start);
        const placeholder = 'text';
        const newContent =
          before + action.prefix + placeholder + action.suffix + after;
        setContent(newContent);

        // Select the placeholder so user can type over it
        const newStart = start + action.prefix.length;
        const newEnd = newStart + placeholder.length;
        setTimeout(() => {
          inputRef.current?.setNativeProps({
            selection: {start: newStart, end: newEnd},
          });
        }, 50);
      }
    },
    [content, setContent],
  );

  const commitRename = useCallback(async () => {
    const trimmed = editedTitle.trim();
    if (trimmed.length > 0 && trimmed !== title) {
      await renamePage(trimmed);
    } else {
      // Reset to original if empty or unchanged
      setEditedTitle(page?.title ?? title);
    }
  }, [editedTitle, title, renamePage, page]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    Keyboard.dismiss();
    await commitRename();
    await flushSave();
    setIsSaving(false);
    // Pop the entire stack back to the Notes timeline
    navigation.popToTop();
  }, [flushSave, navigation, commitRename]);

  const toggleBacklinks = useCallback(() => {
    setShowBacklinks(prev => !prev);
  }, []);

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

  const isPage = (pageType || 'page') === 'page';
  const displayTitle = isPage
    ? editedTitle
    : new Date(title + 'T00:00:00').toLocaleDateString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

  return (
    <ScreenWrapper keyboard>
      {/* Header */}
      <View style={styles.header}>
        {isPage ? (
          <TextInput
            style={styles.titleInput}
            value={editedTitle}
            onChangeText={setEditedTitle}
            onBlur={commitRename}
            returnKeyType="done"
            blurOnSubmit
            selectTextOnFocus
          />
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {displayTitle}
          </Text>
        )}

        <View style={styles.headerActions}>
          {/* Backlinks indicator */}
          {backlinks.length > 0 && (
            <TouchableOpacity
              style={styles.backlinksBadge}
              onPress={toggleBacklinks}
              activeOpacity={0.7}>
              <Text style={styles.backlinksBadgeIcon}>
                {'\u{1F517}'}{/* link emoji */}
              </Text>
              <Text style={styles.backlinksBadgeCount}>
                {backlinks.length}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.modeToggle}
            onPress={toggleMode}
            activeOpacity={0.7}>
            <Text style={styles.modeToggleText}>
              {isEditing ? 'Preview' : 'Edit'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}>
            <Text style={styles.saveButtonText}>
              {isSaving ? '...' : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Backlinks dropdown */}
      {showBacklinks && backlinks.length > 0 && (
        <View style={styles.backlinksDropdown}>
          <Text style={styles.backlinksDropdownHeading}>
            Linked from {backlinks.length} page{backlinks.length > 1 ? 's' : ''}
          </Text>
          {backlinks.map(bl => (
            <TouchableOpacity
              key={bl.id}
              style={styles.backlinksDropdownItem}
              onPress={() => {
                setShowBacklinks(false);
                flushSave();
                navigation.push('PageEditor', {
                  title: bl.title,
                  pageType: bl.pageType,
                  mode: 'preview',
                });
              }}
              activeOpacity={0.7}>
              <Text style={styles.backlinksDropdownIcon}>
                {bl.pageType === 'daily' ? '\u{1F4C5}' : '\u{1F4C4}'}
              </Text>
              <Text style={styles.backlinksDropdownTitle} numberOfLines={1}>
                {bl.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isEditing ? (
        <>
          <TextInput
            ref={inputRef}
            style={[styles.editor, {paddingBottom: Math.max(40, insets.bottom + 16)}]}
            value={content}
            onChangeText={setContent}
            onSelectionChange={handleSelectionChange}
            multiline
            textAlignVertical="top"
            placeholder="Start writing..."
            placeholderTextColor={theme.colors.textMuted}
            autoFocus={content.length === 0}
            scrollEnabled
          />
          {/* Partial transcription preview */}
          {isListening && partialText.length > 0 && (
            <View style={styles.voicePreview}>
              <Text style={styles.voicePreviewText} numberOfLines={2}>
                {partialText}
              </Text>
            </View>
          )}
          <View style={styles.toolbarRow}>
            <FormattingToolbar onFormat={handleFormat} />
            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
              ]}
              onPress={toggleListening}
              activeOpacity={0.6}>
              <Text style={styles.micButtonText}>
                {isListening ? '\u{1F534}' : '\u{1F3A4}'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
            onNavigateToPage={(linkTitle, linkPageType) => {
              flushSave();
              navigation.push('PageEditor', {
                title: linkTitle,
                pageType: linkPageType,
                mode: 'preview',
              });
            }}
          />
        </ScrollView>
      )}
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
        flex: {
          flex: 1,
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
          marginRight: spacing.sm,
        },
        titleInput: {
          flex: 1,
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
          marginRight: spacing.sm,
          padding: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderLight,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        backlinksBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: theme.colors.cardAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        backlinksBadgeIcon: {
          fontSize: 12,
          marginRight: 3,
        },
        backlinksBadgeCount: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.textSecondary,
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
        saveButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: theme.colors.primary,
        },
        saveButtonText: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.textOnPrimary,
        },
        backlinksDropdown: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderLight,
        },
        backlinksDropdownHeading: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.sm,
        },
        backlinksDropdownItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          minHeight: 44,
          borderRadius: radius.sm,
        },
        backlinksDropdownIcon: {
          fontSize: 14,
          marginRight: spacing.sm,
        },
        backlinksDropdownTitle: {
          flex: 1,
          fontSize: 14,
          fontWeight: '500',
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
        toolbarRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        micButton: {
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.borderLight,
          backgroundColor: theme.colors.card,
        },
        micButtonActive: {
          backgroundColor: theme.colors.primaryPale,
        },
        micButtonText: {
          fontSize: 20,
        },
        voicePreview: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.primaryPale,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.borderLight,
        },
        voicePreviewText: {
          fontSize: 13,
          fontStyle: 'italic',
          color: theme.colors.primary,
        },
      }),
    [theme],
  );
