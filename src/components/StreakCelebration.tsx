import React, {useEffect, useRef, useCallback, useMemo} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import {useUIStore} from '../stores/uiStore';
import {stopCelebrationSound} from '../services/feedback';

const {width: W, height: H} = Dimensions.get('window');

// ── Rocket images ────────────────────────────────────────────────────

const ROCKET_IMAGES = [
  require('../assets/images/rocket_1.webp'),
  require('../assets/images/rocket_3.webp'),
];

// ── Star field ───────────────────────────────────────────────────────

const STAR_COUNT = 60;
const PLANET_COUNT = 4;

interface Star {
  x: Animated.Value;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface Planet {
  x: Animated.Value;
  y: number;
  size: number;
  speed: number;
  color: string;
  ringColor: string | null;
  delay: number;
}

function createStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const speed = 1200 + Math.random() * 2800;
    stars.push({
      x: new Animated.Value(W + Math.random() * W),
      y: Math.random() * H,
      size: 1 + Math.random() * 2.5,
      speed,
      opacity: 0.4 + Math.random() * 0.6,
    });
  }
  return stars;
}

function createPlanets(): Planet[] {
  const palette = [
    {color: '#8B8B8B', ringColor: '#AAAAAA'},
    {color: '#C0C0C0', ringColor: null},
    {color: '#E8E8E8', ringColor: '#999999'},
    {color: '#666666', ringColor: '#888888'},
  ];
  const planets: Planet[] = [];
  for (let i = 0; i < PLANET_COUNT; i++) {
    const p = palette[i % palette.length];
    planets.push({
      x: new Animated.Value(W + 60 + Math.random() * W),
      y: 80 + Math.random() * (H - 200),
      size: 18 + Math.random() * 30,
      speed: 3500 + Math.random() * 3000,
      color: p.color,
      ringColor: p.ringColor,
      delay: i * 800 + Math.random() * 600,
    });
  }
  return planets;
}

// ── Component ────────────────────────────────────────────────────────

export default function StreakCelebration() {
  const {celebrationVisible, celebrationStreak, hideCelebration} = useUIStore();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0)).current;
  const imageBounce = useRef(new Animated.Value(0)).current;

  const starsRef = useRef<Star[]>(createStars());
  const planetsRef = useRef<Planet[]>(createPlanets());
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pick a random image once per celebration
  const rocketImage = useMemo(
    () => ROCKET_IMAGES[Math.floor(Math.random() * ROCKET_IMAGES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [celebrationVisible],
  );

  const animateStars = useCallback(() => {
    const stars = starsRef.current;
    const planets = planetsRef.current;

    const starAnims = stars.map(s => {
      s.x.setValue(W + Math.random() * 40);
      return Animated.loop(
        Animated.timing(s.x, {
          toValue: -10,
          duration: s.speed,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    });

    const planetAnims = planets.map(p => {
      p.x.setValue(W + p.size + 40);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.x, {
            toValue: -p.size - 60,
            duration: p.speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      );
    });

    const all = Animated.parallel([...starAnims, ...planetAnims]);
    loopRef.current = all;
    all.start();
  }, []);

  const stopStars = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  useEffect(() => {
    if (!celebrationVisible) {
      return;
    }

    // Reset
    fadeIn.setValue(0);
    textScale.setValue(0.3);
    textOpacity.setValue(0);
    imageScale.setValue(0);
    imageBounce.setValue(0);

    // Start star field
    animateStars();

    // Entrance sequence
    Animated.sequence([
      // Fade in backdrop
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Text slams in + image pops
      Animated.parallel([
        Animated.spring(textScale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(imageScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Gentle bounce loop on the image
    Animated.loop(
      Animated.sequence([
        Animated.timing(imageBounce, {
          toValue: -8,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(imageBounce, {
          toValue: 8,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      dismiss();
    }, 5000);

    return () => {
      clearTimeout(timer);
      stopStars();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrationVisible]);

  const dismiss = useCallback(() => {
    stopCelebrationSound();
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      stopStars();
      hideCelebration();
    });
  }, [fadeIn, textOpacity, stopStars, hideCelebration]);

  if (!celebrationVisible) {
    return null;
  }

  const streakText =
    celebrationStreak >= 2
      ? `${celebrationStreak}-day streak!`
      : 'Streak started!';

  return (
    <TouchableWithoutFeedback onPress={dismiss}>
      <Animated.View style={[styles.container, {opacity: fadeIn}]}>
        {/* Star field */}
        {starsRef.current.map((s, i) => (
          <Animated.View
            key={`s${i}`}
            style={[
              styles.star,
              {
                top: s.y,
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                opacity: s.opacity,
                transform: [{translateX: s.x}],
              },
            ]}
          />
        ))}

        {/* Planets */}
        {planetsRef.current.map((p, i) => (
          <Animated.View
            key={`p${i}`}
            style={{
              position: 'absolute',
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              transform: [{translateX: p.x}],
            }}>
            {p.ringColor && (
              <View
                style={{
                  position: 'absolute',
                  top: p.size * 0.35,
                  left: -p.size * 0.25,
                  width: p.size * 1.5,
                  height: p.size * 0.18,
                  borderRadius: p.size,
                  backgroundColor: p.ringColor,
                  opacity: 0.6,
                }}
              />
            )}
          </Animated.View>
        ))}

        {/* Center content */}
        <View style={styles.content}>
          {/* Streak count */}
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{scale: textScale}],
            }}>
            <Text style={styles.streakNumber}>{streakText}</Text>
          </Animated.View>

          {/* LFG + rocket image row */}
          <Animated.View
            style={[
              styles.lfgRow,
              {
                opacity: textOpacity,
                transform: [{scale: textScale}],
              },
            ]}>
            <Text style={styles.lfgText}>LFG</Text>
            <Animated.Image
              source={rocketImage}
              style={[
                styles.rocketImage,
                {
                  transform: [
                    {scale: imageScale},
                    {translateY: imageBounce},
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 2000,
    elevation: 200,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  lfgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lfgText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  rocketImage: {
    width: 80,
    height: 80,
    marginLeft: 12,
  },
});
