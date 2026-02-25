import React, {useCallback, useEffect, useRef} from 'react';
import {AppState, Animated, NativeModules, Platform, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer, type LinkingOptions} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/react';

import {database} from './src/database';
import {ThemeProvider, useTheme} from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from './src/components/Toast';
import ConfettiOverlay from './src/components/ConfettiOverlay';
import StreakCelebration from './src/components/StreakCelebration';
import {useUIStore} from './src/stores/uiStore';
import {
  setupNotificationChannels,
  setupIOSCategories,
  subscribeForegroundEvents,
} from './src/services/notifications';
import {configureBackgroundFetch} from './src/services/backgroundTasks';
import {recalculateAllStreaks} from './src/services/streakEngine';
import {preloadSounds} from './src/services/feedback';

function ConfettiBanner() {
  const theme = useTheme();
  const {confettiVisible, confettiMessage, hideConfetti} = useUIStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (confettiVisible) {
      opacity.setValue(0);
      scale.setValue(0.8);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [confettiVisible, opacity, scale]);

  const handleConfettiDone = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        delay: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 400,
        delay: 1200,
        useNativeDriver: true,
      }),
    ]).start(() => hideConfetti());
  }, [opacity, scale, hideConfetti]);

  return (
    <>
      <ConfettiOverlay
        visible={confettiVisible}
        onComplete={handleConfettiDone}
      />
      {confettiVisible && confettiMessage && (
        <Animated.View
          style={[
            bannerStyles.container,
            {opacity, transform: [{scale}]},
          ]}
          pointerEvents="none">
          <View
            style={[
              bannerStyles.bubble,
              {
                backgroundColor: theme.colors.primary,
                ...theme.shadows.glow,
              },
            ]}>
            <Text style={[bannerStyles.text, {color: theme.colors.textOnPrimary}]}>
              {confettiMessage}
            </Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2101,
  },
  bubble: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
  },
  text: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});

function AppContent() {
  const theme = useTheme();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Initialize notification channels (Android) and iOS categories
    setupNotificationChannels();
    setupIOSCategories();

    // Preload celebration sound effects
    preloadSounds();

    // Subscribe to foreground notification events
    const unsubscribeNotifications = subscribeForegroundEvents();

    // Configure background fetch for nightly streak recalculation
    configureBackgroundFetch().catch(err =>
      console.error('[BackgroundFetch] configuration error:', err),
    );

    // Recalculate streaks when app comes to foreground
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          recalculateAllStreaks().catch(err =>
            console.error('Foreground streak recalc error:', err),
          );
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      unsubscribeNotifications();
      appStateSubscription.remove();
    };
  }, []);

  // Set Android system navigation bar color to match the theme background
  useEffect(() => {
    if (Platform.OS === 'android') {
      NativeModules.NavigationBarColor?.setColor(
        theme.colors.bg,
        !theme.statusBarLight, // light icons on dark bg → isLight=false
      );
    }
  }, [theme]);

  return (
    <>
      <StatusBar
        barStyle={theme.statusBarLight ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
      <Toast />
      <ConfettiBanner />
      <StreakCelebration />
    </>
  );
}

const linking: LinkingOptions<any> = {
  prefixes: ['lfg://', 'https://lfghabits.app'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          ReceiveShare: {
            path: 'share',
            parse: {
              name: (name: string) => decodeURIComponent(name),
              rrule: (rrule: string) => decodeURIComponent(rrule),
              time: (time: string) => decodeURIComponent(time),
              duration: (duration: string) => Number(duration),
            },
          },
        },
      },
    },
  },
};

function App() {
  return (
    <DatabaseProvider database={database}>
      <ThemeProvider>
        <SafeAreaProvider>
          <NavigationContainer linking={linking}>
            <AppContent />
          </NavigationContainer>
        </SafeAreaProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

export default App;
