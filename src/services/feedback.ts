import {Platform} from 'react-native';
import Sound from 'react-native-sound';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

// Enable playback in silent mode on iOS
Sound.setCategory('Playback');

const SOUND_FILES = [
  'crowd_cheer_1.mp3',
  'crowd_cheer_2.mp3',
  'crowd_cheer_3.mp3',
];

const CELEBRATION_DURATION = 5000; // matches popup duration
const FADE_OUT_DURATION = 800; // fade out over the last 800ms
const FADE_STEPS = 16;

let loadedSounds: Sound[] = [];
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let activeSound: Sound | null = null;

/**
 * Preloads all crowd cheer sounds so they play instantly when triggered.
 * Call once at app startup.
 */
export function preloadSounds(): void {
  if (loadedSounds.length > 0) {
    return;
  }

  for (const file of SOUND_FILES) {
    const sound = new Sound(file, Sound.MAIN_BUNDLE, error => {
      if (error) {
        console.warn(`Failed to preload ${file}:`, error);
      }
    });
    loadedSounds.push(sound);
  }
}

/**
 * Gradually fades the volume of a sound to 0, then stops it.
 */
function fadeOutAndStop(sound: Sound): void {
  let step = 0;
  const interval = FADE_OUT_DURATION / FADE_STEPS;

  const tick = () => {
    step++;
    const volume = Math.max(0, 0.8 * (1 - step / FADE_STEPS));
    sound.setVolume(volume);
    if (step < FADE_STEPS) {
      fadeTimer = setTimeout(tick, interval);
    } else {
      sound.stop();
      activeSound = null;
      fadeTimer = null;
    }
  };

  fadeTimer = setTimeout(tick, interval);
}

/**
 * Picks a random cheer sound, plays it, and fades out after the celebration duration.
 */
function playCrowdCheer(): void {
  if (loadedSounds.length === 0) {
    preloadSounds();
  }

  if (loadedSounds.length === 0) {
    return;
  }

  // Stop any currently playing sound and cancel pending fade
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  if (activeSound) {
    activeSound.stop();
    activeSound = null;
  }

  const sound = loadedSounds[Math.floor(Math.random() * loadedSounds.length)];
  activeSound = sound;

  sound.stop(() => {
    sound.setVolume(0.8);
    sound.play(success => {
      if (!success) {
        console.warn('Crowd cheer playback failed');
      }
    });

    // Start fade-out near the end of the celebration popup
    fadeTimer = setTimeout(() => {
      fadeOutAndStop(sound);
    }, CELEBRATION_DURATION - FADE_OUT_DURATION);
  });
}

/**
 * Immediately stops any playing celebration sound (e.g. on early dismiss).
 */
export function stopCelebrationSound(): void {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  if (activeSound) {
    // Quick fade instead of abrupt stop
    fadeOutAndStop(activeSound);
  }
}

/**
 * Triggers a strong haptic feedback (notification success + impact).
 */
function triggerHaptic(): void {
  const options = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  if (Platform.OS === 'ios') {
    // notificationSuccess gives a satisfying triple-tap
    ReactNativeHapticFeedback.trigger(
      HapticFeedbackTypes.notificationSuccess,
      options,
    );

    // Follow up with a heavier impact after a short delay for "roar" feel
    setTimeout(() => {
      ReactNativeHapticFeedback.trigger(
        HapticFeedbackTypes.impactHeavy,
        options,
      );
    }, 150);
  } else {
    // Android: use impactHeavy which maps to a strong vibration
    ReactNativeHapticFeedback.trigger(
      HapticFeedbackTypes.impactHeavy,
      options,
    );
  }
}

/**
 * Plays the celebration feedback: random crowd cheer sound + haptic vibration.
 * Call this when an activity is successfully logged.
 */
export function playCelebrationFeedback(): void {
  playCrowdCheer();
  triggerHaptic();
}
