/**
 * ScreenWrapper - Unified screen container for all app screens.
 *
 * Handles:
 *   - Safe area insets (top, bottom edges)
 *   - Themed background color
 *   - Optional KeyboardAvoidingView for form screens
 *
 * Usage:
 *   <ScreenWrapper>
 *     { ... screen content ... }
 *   </ScreenWrapper>
 *
 *   <ScreenWrapper keyboard bgColor={theme.colors.bgLight}>
 *     { ... form content with keyboard avoidance ... }
 *   </ScreenWrapper>
 */

import React, {useMemo} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView, type Edge} from 'react-native-safe-area-context';
import {useTheme} from '../theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /** Wrap content in a KeyboardAvoidingView (default: false) */
  keyboard?: boolean;
  /** Override the background color (default: theme.colors.bg) */
  bgColor?: string;
  /** Safe area edges to respect (default: ['top']) */
  edges?: Edge[];
  /** Extra style applied to the outermost container */
  style?: ViewStyle;
  /** keyboardVerticalOffset for KeyboardAvoidingView (default: 100) */
  keyboardOffset?: number;
}

export default function ScreenWrapper({
  children,
  keyboard = false,
  bgColor,
  edges = ['top'],
  style,
  keyboardOffset = 100,
}: ScreenWrapperProps) {
  const theme = useTheme();
  const backgroundColor = bgColor ?? theme.colors.bg;

  const containerStyle = useMemo(
    () => [styles.container, {backgroundColor}, style],
    [backgroundColor, style],
  );

  if (keyboard) {
    return (
      <SafeAreaView style={containerStyle} edges={edges}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardOffset}>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
