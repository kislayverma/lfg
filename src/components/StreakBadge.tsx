import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme';

interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

export default function StreakBadge({
  streak,
  size = 'md',
  showLabel = false,
  animate = true,
}: StreakBadgeProps) {
  const theme = useTheme();
  const level = theme.getStreakLevel(streak);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || streak === 0) {
      scaleAnim.setValue(1);
      return;
    }

    // Bounce in
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Pulsing glow for active streaks >= 7
    if (streak >= 7) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [streak, animate, scaleAnim, glowAnim]);

  if (streak === 0) {
    return null;
  }

  const dimensions = size === 'lg' ? 56 : size === 'md' ? 40 : 28;
  const fontSize = size === 'lg' ? 18 : size === 'md' ? 14 : 11;
  const emojiSize = size === 'lg' ? 20 : size === 'md' ? 14 : 10;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.4],
  });

  return (
    <Animated.View style={{transform: [{scale: scaleAnim}]}}>
      <View style={styles.wrapper}>
        {/* Glow layer */}
        {streak >= 7 && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: dimensions + 12,
                height: dimensions + 12,
                borderRadius: (dimensions + 12) / 2,
                backgroundColor: level.color,
                opacity: glowOpacity,
              },
            ]}
          />
        )}
        <View
          style={[
            styles.badge,
            {
              width: dimensions,
              height: dimensions,
              borderRadius: dimensions / 2,
              backgroundColor: level.color + '15',
              borderColor: level.color + '30',
            },
          ]}>
          <Text style={{fontSize: emojiSize}}>{level.emoji}</Text>
          <Text
            style={[
              styles.count,
              {fontSize, color: level.color},
            ]}>
            {streak}
          </Text>
        </View>
      </View>
      {showLabel && (
        <Text style={[styles.label, {color: level.color}]}>
          {level.label}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  count: {
    fontWeight: '800',
    marginTop: -1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
