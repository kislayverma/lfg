/**
 * Formatting Toolbar for the Notes editor.
 *
 * Renders a horizontal row of tap-to-insert formatting buttons
 * above the keyboard so users don't need to memorize markdown syntax.
 *
 * Each button inserts the corresponding markdown at the current
 * cursor position (or wraps the current selection).
 */

import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useTheme, spacing, radius} from '../../../theme';
import type {Theme} from '../../../theme/types';

export interface FormatAction {
  /** Label shown on the button */
  label: string;
  /** Markdown prefix to insert before cursor / selection */
  prefix: string;
  /** Markdown suffix to insert after cursor / selection (for wrapping) */
  suffix: string;
  /** Whether this is a line-level format (inserted at start of line) */
  isLinePrefix: boolean;
}

const FORMAT_ACTIONS: FormatAction[] = [
  {label: 'B', prefix: '**', suffix: '**', isLinePrefix: false},
  {label: 'I', prefix: '*', suffix: '*', isLinePrefix: false},
  {label: 'H1', prefix: '# ', suffix: '', isLinePrefix: true},
  {label: 'H2', prefix: '## ', suffix: '', isLinePrefix: true},
  {label: '\u2022', prefix: '- ', suffix: '', isLinePrefix: true}, // bullet
  {label: '\u2610', prefix: '- [ ] ', suffix: '', isLinePrefix: true}, // checklist
  {label: '1.', prefix: '1. ', suffix: '', isLinePrefix: true},
  {label: '\u201C', prefix: '> ', suffix: '', isLinePrefix: true}, // blockquote
  {label: '[[', prefix: '[[', suffix: ']]', isLinePrefix: false}, // wiki link
  {label: '~', prefix: '~~', suffix: '~~', isLinePrefix: false}, // strikethrough
  {label: '</>', prefix: '`', suffix: '`', isLinePrefix: false}, // inline code
  {label: '\u2015', prefix: '---', suffix: '', isLinePrefix: true}, // horizontal rule
];

interface FormattingToolbarProps {
  onFormat: (action: FormatAction) => void;
}

export default function FormattingToolbar({onFormat}: FormattingToolbarProps) {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always">
        {FORMAT_ACTIONS.map((action, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.button}
            onPress={() => onFormat(action)}
            activeOpacity={0.6}>
            <Text
              style={[
                styles.buttonText,
                action.label === 'B' && styles.boldLabel,
                action.label === 'I' && styles.italicLabel,
              ]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.borderLight,
          backgroundColor: theme.colors.card,
        },
        scrollContent: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
        },
        button: {
          minWidth: 36,
          height: 36,
          borderRadius: radius.sm,
          backgroundColor: theme.colors.cardAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
        },
        buttonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.text,
        },
        boldLabel: {
          fontWeight: '900',
        },
        italicLabel: {
          fontStyle: 'italic',
        },
      }),
    [theme],
  );
