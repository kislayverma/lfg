import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {parseMarkdown, parseInline, type Token} from '../utils/markdownParser';
import {useTheme, spacing, radius} from '../../../theme';
import type {Theme} from '../../../theme/types';

interface MarkdownRendererProps {
  content: string;
  onLinkPress?: (title: string) => void;
}

export default function MarkdownRenderer({
  content,
  onLinkPress,
}: MarkdownRendererProps) {
  const theme = useTheme();
  const styles = useStyles(theme);
  const tokens = useMemo(() => parseMarkdown(content), [content]);

  return (
    <View>
      {tokens.map((token, i) => (
        <BlockToken
          key={i}
          token={token}
          styles={styles}
          theme={theme}
          onLinkPress={onLinkPress}
        />
      ))}
    </View>
  );
}

function BlockToken({
  token,
  styles,
  theme,
  onLinkPress,
}: {
  token: Token;
  styles: ReturnType<typeof useStyles>;
  theme: Theme;
  onLinkPress?: (title: string) => void;
}) {
  switch (token.type) {
    case 'h1':
      return (
        <Text style={styles.h1}>
          <InlineTokens
            tokens={token.children || []}
            styles={styles}
            theme={theme}
            onLinkPress={onLinkPress}
          />
        </Text>
      );
    case 'h2':
      return (
        <Text style={styles.h2}>
          <InlineTokens
            tokens={token.children || []}
            styles={styles}
            theme={theme}
            onLinkPress={onLinkPress}
          />
        </Text>
      );
    case 'h3':
      return (
        <Text style={styles.h3}>
          <InlineTokens
            tokens={token.children || []}
            styles={styles}
            theme={theme}
            onLinkPress={onLinkPress}
          />
        </Text>
      );
    case 'bullet':
      return (
        <View style={styles.listItem}>
          <Text style={styles.bullet}>{'\u2022'} </Text>
          <Text style={styles.listText}>
            <InlineTokens
              tokens={token.children || []}
              styles={styles}
              theme={theme}
              onLinkPress={onLinkPress}
            />
          </Text>
        </View>
      );
    case 'numbered':
      return (
        <View style={styles.listItem}>
          <Text style={styles.bullet}>{token.content ? '' : '1.'} </Text>
          <Text style={styles.listText}>
            <InlineTokens
              tokens={token.children || []}
              styles={styles}
              theme={theme}
              onLinkPress={onLinkPress}
            />
          </Text>
        </View>
      );
    case 'checklist':
      return (
        <View style={styles.listItem}>
          <Text style={styles.checkbox}>
            {token.checked ? '\u2611' : '\u2610'}{' '}
          </Text>
          <Text
            style={[
              styles.listText,
              token.checked && styles.checkedText,
            ]}>
            <InlineTokens
              tokens={token.children || []}
              styles={styles}
              theme={theme}
              onLinkPress={onLinkPress}
            />
          </Text>
        </View>
      );
    case 'blockquote':
      return (
        <View style={styles.blockquote}>
          <Text style={styles.blockquoteText}>
            <InlineTokens
              tokens={token.children || []}
              styles={styles}
              theme={theme}
              onLinkPress={onLinkPress}
            />
          </Text>
        </View>
      );
    case 'codeBlock':
      return (
        <View style={styles.codeBlock}>
          <Text style={styles.codeBlockText}>{token.content}</Text>
        </View>
      );
    case 'hr':
      return <View style={styles.hr} />;
    case 'newline':
      return <View style={styles.newline} />;
    case 'text':
    default:
      if (!token.content && (!token.children || token.children.length === 0)) {
        return <View style={styles.newline} />;
      }
      return (
        <Text style={styles.paragraph}>
          <InlineTokens
            tokens={token.children || parseInline(token.content)}
            styles={styles}
            theme={theme}
            onLinkPress={onLinkPress}
          />
        </Text>
      );
  }
}

function InlineTokens({
  tokens,
  styles,
  theme,
  onLinkPress,
}: {
  tokens: Token[];
  styles: ReturnType<typeof useStyles>;
  theme: Theme;
  onLinkPress?: (title: string) => void;
}) {
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'bold':
            return (
              <Text key={i} style={styles.bold}>
                {token.content}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={styles.italic}>
                {token.content}
              </Text>
            );
          case 'strikethrough':
            return (
              <Text key={i} style={styles.strikethrough}>
                {token.content}
              </Text>
            );
          case 'code':
            return (
              <Text key={i} style={styles.inlineCode}>
                {token.content}
              </Text>
            );
          case 'wikiLink':
            return (
              <Text
                key={i}
                style={styles.wikiLink}
                onPress={() => onLinkPress?.(token.content)}>
                {token.content}
              </Text>
            );
          case 'text':
          default:
            return (
              <Text key={i} style={styles.text}>
                {token.content}
              </Text>
            );
        }
      })}
    </>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        // Block styles
        h1: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginTop: spacing.lg,
          marginBottom: spacing.sm,
          letterSpacing: -0.3,
        },
        h2: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        h3: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        paragraph: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.text,
          marginBottom: spacing.xs,
        },
        listItem: {
          flexDirection: 'row',
          paddingLeft: spacing.sm,
          marginBottom: 2,
        },
        bullet: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.textSecondary,
          width: 20,
        },
        checkbox: {
          fontSize: 16,
          lineHeight: 22,
          color: theme.colors.primary,
          width: 24,
        },
        listText: {
          flex: 1,
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.text,
        },
        checkedText: {
          textDecorationLine: 'line-through',
          color: theme.colors.textMuted,
        },
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.primary,
          paddingLeft: spacing.md,
          paddingVertical: spacing.xs,
          marginVertical: spacing.xs,
          backgroundColor: theme.colors.primaryPale,
          borderRadius: radius.sm,
        },
        blockquoteText: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.textSecondary,
          fontStyle: 'italic',
        },
        codeBlock: {
          backgroundColor: theme.colors.elevated,
          borderRadius: radius.sm,
          padding: spacing.md,
          marginVertical: spacing.sm,
        },
        codeBlockText: {
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 20,
          color: theme.colors.text,
        },
        hr: {
          height: 1,
          backgroundColor: theme.colors.borderLight,
          marginVertical: spacing.lg,
        },
        newline: {
          height: spacing.sm,
        },
        // Inline styles
        text: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.colors.text,
        },
        bold: {
          fontWeight: '700',
          color: theme.colors.text,
        },
        italic: {
          fontStyle: 'italic',
          color: theme.colors.text,
        },
        strikethrough: {
          textDecorationLine: 'line-through',
          color: theme.colors.textMuted,
        },
        inlineCode: {
          fontFamily: 'monospace',
          fontSize: 13,
          backgroundColor: theme.colors.elevated,
          color: theme.colors.accent,
          paddingHorizontal: 4,
          borderRadius: 3,
        },
        wikiLink: {
          color: theme.colors.primary,
          fontWeight: '600',
          textDecorationLine: 'underline',
        },
      }),
    [theme],
  );
