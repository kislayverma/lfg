import type {Theme} from '../types';

const colors = {
  primary: '#E8563A',
  primaryLight: '#F07858',
  primaryPale: 'rgba(232,86,58,0.10)',
  primaryGlow: 'rgba(232,86,58,0.20)',

  accent: '#7C5CFC',
  accentPale: 'rgba(124,92,252,0.10)',
  accentGlow: 'rgba(124,92,252,0.20)',

  bg: '#FBF7F4',
  bgLight: '#FFFFFF',
  card: 'rgba(255,255,255,0.85)',
  cardAlt: 'rgba(255,255,255,0.60)',
  elevated: '#FFFFFF',

  glassBorder: 'rgba(0,0,0,0.06)',
  glassBorderLight: 'rgba(0,0,0,0.03)',
  glassHighlight: 'rgba(255,255,255,0.90)',

  text: '#1A1A2E',
  textSecondary: 'rgba(26,26,46,0.60)',
  textMuted: 'rgba(26,26,46,0.38)',
  textOnPrimary: '#FFFFFF',

  success: '#2ECC71',
  successPale: 'rgba(46,204,113,0.10)',
  warning: '#F39C12',
  warningPale: 'rgba(243,156,18,0.10)',
  danger: '#E74C3C',
  dangerPale: 'rgba(231,76,60,0.10)',
  info: '#3498DB',
  infoPale: 'rgba(52,152,219,0.10)',

  border: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.04)',

  flame1: '#E8563A',
  flame2: '#D4402A',
  flame3: '#F7B731',

  tabInactive: 'rgba(26,26,46,0.30)',
  tabBar: 'rgba(255,255,255,0.95)',
  tabBarBorder: 'rgba(0,0,0,0.06)',
} as const;

export const warmGradientTheme: Theme = {
  id: 'warmGradient',
  name: 'Warm Gradient',
  description: 'Light, warm tones with soft gradients',

  colors,

  gradients: {
    warmHeader: ['#E8563A', '#F07858'],
    streakFire: ['#D4402A', '#E8563A', '#F7B731'],
    celebration: ['#F7B731', '#E8563A', '#D4402A'],
    glass: ['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.60)'],
  },

  shadows: {
    sm: {
      shadowColor: 'rgba(26,26,46,0.08)',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: 'rgba(26,26,46,0.10)',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: 'rgba(26,26,46,0.12)',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#E8563A',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    accentGlow: {
      shadowColor: '#7C5CFC',
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

  confettiColors: ['#E8563A', '#7C5CFC', '#F7B731', '#2ECC71', '#3498DB', '#F39C12'],

  getStreakLevel(streak: number) {
    if (streak >= 100) {
      return {emoji: '\u{1F451}', label: 'Legendary', color: '#D4402A', glowIntensity: 1.0};
    }
    if (streak >= 30) {
      return {emoji: '\u{1F525}\u{1F525}\u{1F525}', label: 'On Fire', color: '#E8563A', glowIntensity: 0.8};
    }
    if (streak >= 14) {
      return {emoji: '\u{1F525}\u{1F525}', label: 'Blazing', color: '#F07858', glowIntensity: 0.6};
    }
    if (streak >= 7) {
      return {emoji: '\u{1F525}', label: 'Warming Up', color: '#F39C12', glowIntensity: 0.4};
    }
    if (streak >= 3) {
      return {emoji: '\u{2728}', label: 'Sparking', color: '#7C5CFC', glowIntensity: 0.2};
    }
    if (streak >= 1) {
      return {emoji: '\u{1F331}', label: 'Sprouting', color: '#2ECC71', glowIntensity: 0.1};
    }
    return {emoji: '', label: '', color: colors.textMuted, glowIntensity: 0};
  },
};
