import type {Theme} from '../types';

const colors = {
  primary: '#FF5F1F',
  primaryLight: '#FF7A45',
  primaryPale: 'rgba(255,95,31,0.12)',
  primaryGlow: 'rgba(255,95,31,0.25)',

  accent: '#00E5FF',
  accentPale: 'rgba(0,229,255,0.12)',
  accentGlow: 'rgba(0,229,255,0.25)',

  bg: '#0D0D0F',
  bgLight: '#141418',
  card: 'rgba(255,255,255,0.06)',
  cardAlt: 'rgba(255,255,255,0.03)',
  elevated: 'rgba(255,255,255,0.10)',

  glassBorder: 'rgba(255,255,255,0.08)',
  glassBorderLight: 'rgba(255,255,255,0.04)',
  glassHighlight: 'rgba(255,255,255,0.12)',

  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textOnPrimary: '#FFFFFF',

  success: '#00E676',
  successPale: 'rgba(0,230,118,0.12)',
  warning: '#FFB300',
  warningPale: 'rgba(255,179,0,0.12)',
  danger: '#FF5252',
  dangerPale: 'rgba(255,82,82,0.12)',
  info: '#448AFF',
  infoPale: 'rgba(68,138,255,0.12)',

  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.04)',

  flame1: '#FF5F1F',
  flame2: '#FF3D00',
  flame3: '#FFD600',

  tabInactive: 'rgba(255,255,255,0.3)',
  tabBar: 'rgba(13,13,15,0.95)',
  tabBarBorder: 'rgba(255,255,255,0.06)',
} as const;

export const neonGlassTheme: Theme = {
  id: 'neonGlass',
  name: 'Neon Glass',
  description: 'Dark glassmorphism with neon accents',

  colors,

  gradients: {
    warmHeader: ['#FF5F1F', '#FF7A45'],
    streakFire: ['#FF3D00', '#FF5F1F', '#FFD600'],
    celebration: ['#FFD600', '#FF5F1F', '#FF3D00'],
    glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
  },

  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#FF5F1F',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    accentGlow: {
      shadowColor: '#00E5FF',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  glassCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  statusBarLight: true,

  confettiColors: ['#00E5FF', '#FF5F1F', '#FF3D00', '#FFD600', '#E040FB', '#00E676'],

  getStreakLevel(streak: number) {
    if (streak >= 100) {
      return {emoji: '\u{1F451}', label: 'Legendary', color: '#FFD600', glowIntensity: 1.0};
    }
    if (streak >= 30) {
      return {emoji: '\u{1F525}\u{1F525}\u{1F525}', label: 'On Fire', color: '#FF3D00', glowIntensity: 0.8};
    }
    if (streak >= 14) {
      return {emoji: '\u{1F525}\u{1F525}', label: 'Blazing', color: '#FF5F1F', glowIntensity: 0.6};
    }
    if (streak >= 7) {
      return {emoji: '\u{1F525}', label: 'Warming Up', color: '#FF7A45', glowIntensity: 0.4};
    }
    if (streak >= 3) {
      return {emoji: '\u{2728}', label: 'Sparking', color: '#FFB300', glowIntensity: 0.2};
    }
    if (streak >= 1) {
      return {emoji: '\u{1F331}', label: 'Sprouting', color: '#00E676', glowIntensity: 0.1};
    }
    return {emoji: '', label: '', color: colors.textMuted, glowIntensity: 0};
  },
};
