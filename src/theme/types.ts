/**
 * Theme type contract.
 * Every theme must implement this interface. Components reference these
 * properties via useTheme() so all themes are guaranteed to "just work"
 * regardless of layout changes.
 */

export interface ThemeColors {
  // Brand
  primary: string;
  primaryLight: string;
  primaryPale: string;
  primaryGlow: string;

  // Secondary accent
  accent: string;
  accentPale: string;
  accentGlow: string;

  // Backgrounds
  bg: string;
  bgLight: string;
  card: string;
  cardAlt: string;
  elevated: string;

  // Glass
  glassBorder: string;
  glassBorderLight: string;
  glassHighlight: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Semantic
  success: string;
  successPale: string;
  warning: string;
  warningPale: string;
  danger: string;
  dangerPale: string;
  info: string;
  infoPale: string;

  // Borders / dividers
  border: string;
  borderLight: string;

  // Streak flame colors
  flame1: string;
  flame2: string;
  flame3: string;

  // Tab bar
  tabInactive: string;
  tabBar: string;
  tabBarBorder: string;
}

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: {width: number; height: number};
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeShadows {
  sm: ThemeShadow;
  md: ThemeShadow;
  lg: ThemeShadow;
  glow: ThemeShadow;
  accentGlow: ThemeShadow;
}

export interface ThemeGradients {
  warmHeader: readonly string[];
  streakFire: readonly string[];
  celebration: readonly string[];
  glass: readonly string[];
}

export interface ThemeGlassCard {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
}

export interface StreakLevel {
  emoji: string;
  label: string;
  color: string;
  glowIntensity: number;
}

export type ThemeId = 'neonGlass' | 'warmGradient' | 'monoBold';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;

  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  glassCard: ThemeGlassCard;

  /** Whether the status bar should use light content (true for dark themes). */
  statusBarLight: boolean;

  /**
   * Confetti / celebration particle colors.
   */
  confettiColors: readonly string[];

  /**
   * Streak-level visual tiers. The function returns level info
   * for a given streak count, with colors matching the theme.
   */
  getStreakLevel: (streak: number) => StreakLevel;
}
