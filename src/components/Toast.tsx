import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {useUIStore} from '../stores/uiStore';
import {useTheme, spacing, radius} from '../theme';
import type {Theme} from '../theme';

export default function Toast() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const toastMessage = useUIStore(s => s.toastMessage);
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const isStreak = toastMessage?.includes('streak') || toastMessage?.includes('fire');

  useEffect(() => {
    if (toastMessage) {
      // Reset
      translateY.setValue(80);
      opacity.setValue(0);
      scale.setValue(0.9);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hold, then dismiss
        Animated.sequence([
          Animated.delay(2500),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 80,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }
  }, [toastMessage, translateY, opacity, scale]);

  if (!toastMessage) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        isStreak ? styles.containerStreak : null,
        {
          opacity,
          transform: [{translateY}, {scale}],
        },
      ]}>
      {isStreak && <Text style={styles.emoji}>{'\u{1F525}'}</Text>}
      <View style={styles.textContainer}>
        <Text style={[styles.text, isStreak && styles.textStreak]}>
          {toastMessage}
        </Text>
      </View>
      {isStreak && <Text style={styles.emoji}>{'\u{1F525}'}</Text>}
    </Animated.View>
  );
}

function useStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          bottom: 100,
          left: spacing.xl,
          right: spacing.xl,
          backgroundColor: theme.colors.elevated,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          borderRadius: radius.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          ...theme.shadows.lg,
        },
        containerStreak: {
          backgroundColor: theme.colors.primaryPale,
          borderColor: theme.colors.primaryGlow,
        },
        textContainer: {
          flex: 1,
          alignItems: 'center',
        },
        text: {
          color: theme.colors.text,
          fontSize: 15,
          fontWeight: '600',
          textAlign: 'center',
        },
        textStreak: {
          fontSize: 16,
          fontWeight: '700',
        },
        emoji: {
          fontSize: 20,
          marginHorizontal: spacing.xs,
        },
      }),
    [theme],
  );
}
