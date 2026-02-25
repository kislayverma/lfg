import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, StyleSheet, View} from 'react-native';
import {useTheme} from '../theme';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const PARTICLE_COUNT = 24;

interface ConfettiOverlayProps {
  visible: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  startX: number;
  shape: 'circle' | 'square' | 'rect';
}

export default function ConfettiOverlay({visible, onComplete}: ConfettiOverlayProps) {
  const theme = useTheme();
  const particles = useRef<Particle[]>([]);

  // Initialize particles
  if (particles.current.length === 0) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.current.push({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        rotation: new Animated.Value(0),
        opacity: new Animated.Value(0),
        color: theme.confettiColors[i % theme.confettiColors.length],
        size: 6 + Math.random() * 8,
        startX: Math.random() * SCREEN_WIDTH,
        shape: ['circle', 'square', 'rect'][Math.floor(Math.random() * 3)] as Particle['shape'],
      });
    }
  }

  useEffect(() => {
    if (!visible) {
      return;
    }

    const animations = particles.current.map(p => {
      // Reset
      p.x.setValue(0);
      p.y.setValue(0);
      p.rotation.setValue(0);
      p.opacity.setValue(1);

      const drift = (Math.random() - 0.5) * SCREEN_WIDTH * 0.6;
      const duration = 1800 + Math.random() * 1200;
      const delay = Math.random() * 400;

      return Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(p.y, {
            toValue: SCREEN_HEIGHT * 0.7,
            duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(p.x, {
            toValue: drift,
            duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(p.rotation, {
            toValue: 4 + Math.random() * 6,
            duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay + duration * 0.6),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: duration * 0.4,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      onComplete?.();
    });
  }, [visible, onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.current.map((p, i) => {
        const spin = p.rotation.interpolate({
          inputRange: [0, 10],
          outputRange: ['0deg', '3600deg'],
        });

        const borderRadius =
          p.shape === 'circle' ? p.size / 2 : p.shape === 'square' ? 2 : 1;
        const width = p.shape === 'rect' ? p.size * 1.8 : p.size;

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: p.startX,
                top: -10,
                width,
                height: p.size,
                borderRadius,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  {translateX: p.x},
                  {translateY: p.y},
                  {rotate: spin},
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2100,
    elevation: 210,
  },
  particle: {
    position: 'absolute',
  },
});
