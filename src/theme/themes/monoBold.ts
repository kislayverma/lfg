import type {Theme} from '../types';

const colors = {
  primary: '#1A1A2E',
  primaryLight: '#2D2D44',
  primaryPale: 'rgba(26,26,46,0.08)',
  primaryGlow: 'rgba(26,26,46,0.15)',

  accent: '#FF2D55',
  accentPale: 'rgba(255,45,85,0.10)',
  accentGlow: 'rgba(255,45,85,0.20)',

  bg: '#F5F5F7',
  bgLight: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F0F0F2',
  elevated: '#FFFFFF',

  glassBorder: 'rgba(0,0,0,0.06)',
  glassBorderLight: 'rgba(0,0,0,0.03)',
  glassHighlight: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: 'rgba(26,26,46,0.55)',
  textMuted: 'rgba(26,26,46,0.35)',
  textOnPrimary: '#FFFFFF',

  success: '#34C759',
  successPale: 'rgba(52,199,89,0.10)',
  warning: '#FF9500',
  warningPale: 'rgba(255,149,0,0.10)',
  danger: '#FF3B30',
  dangerPale: 'rgba(255,59,48,0.10)',
  info: '#007AFF',
  infoPale: 'rgba(0,122,255,0.10)',

  border: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.04)',

  flame1: '#FF2D55',
  flame2: '#FF3B30',
  flame3: '#FF9500',

  tabInactive: 'rgba(26,26,46,0.30)',
  tabBar: 'rgba(255,255,255,0.97)',
  tabBarBorder: 'rgba(0,0,0,0.08)',
} as const;

export const monoBoldTheme: Theme = {
  id: 'monoBold',
  name: 'Mono Bold',
  description: 'Clean monochrome with bold accent',

  colors,

  gradients: {
    warmHeader: ['#1A1A2E', '#2D2D44'],
    streakFire: ['#FF3B30', '#FF2D55', '#FF9500'],
    celebration: ['#FF9500', '#FF2D55', '#FF3B30'],
    glass: ['#FFFFFF', '#F5F5F7'],
  },

  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.10,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#1A1A2E',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    accentGlow: {
      shadowColor: '#FF2D55',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.20,
      shadowRadius: 10,
      elevation: 4,
    },
  },

  glassCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  statusBarLight: false,

  confettiColors: ['#1A1A2E', '#FF2D55', '#FF9500', '#34C759', '#007AFF', '#FF3B30'],

  getStreakLevel(streak: number) {
    if (streak >= 100) {
      return {emoji: '\u{1F451}', label: 'Legendary', color: '#FF2D55', glowIntensity: 1.0};
    }
    if (streak >= 30) {
      return {emoji: '\u{1F525}\u{1F525}\u{1F525}', label: 'On Fire', color: '#FF3B30', glowIntensity: 0.8};
    }
    if (streak >= 14) {
      return {emoji: '\u{1F525}\u{1F525}', label: 'Blazing', color: '#FF9500', glowIntensity: 0.6};
    }
    if (streak >= 7) {
      return {emoji: '\u{1F525}', label: 'Warming Up', color: '#1A1A2E', glowIntensity: 0.4};
    }
    if (streak >= 3) {
      return {emoji: '\u{2728}', label: 'Sparking', color: '#007AFF', glowIntensity: 0.2};
    }
    if (streak >= 1) {
      return {emoji: '\u{1F331}', label: 'Sprouting', color: '#34C759', glowIntensity: 0.1};
    }
    return {emoji: '', label: '', color: colors.textMuted, glowIntensity: 0};
  },
};
