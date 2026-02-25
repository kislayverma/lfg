/**
 * Theme system entry point.
 *
 * Visual properties (colors, shadows, glassCard, etc.) come from the active
 * theme via useTheme(). Layout constants (spacing, radius) and non-visual
 * utilities (emptyStates, getStreakMessage) are shared across all themes.
 */

// Context & hook
export {ThemeProvider, useTheme, themes} from './ThemeContext';

// Types
export type {Theme, ThemeId, ThemeColors, ThemeShadow, ThemeShadows, ThemeGradients, ThemeGlassCard, StreakLevel} from './types';

// ── Shared layout constants (not theme-dependent) ──────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  hero: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  stat: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
} as const;

// ── Non-visual utilities ───────────────────────────────────────────────

/**
 * Encouraging copy for various streak milestones.
 */
export function getStreakMessage(streak: number, name?: string): string {
  const activity = name || 'this';
  if (streak >= 100) {return `Legendary! ${streak} days of ${activity}!`;}
  if (streak >= 30) {return `Unstoppable! ${streak}-day streak on ${activity}!`;}
  if (streak >= 14) {return `On fire! ${streak} days strong with ${activity}!`;}
  if (streak >= 7) {return `One week down! ${streak} days of ${activity}!`;}
  if (streak >= 3) {return `Building momentum! ${streak}-day streak!`;}
  if (streak >= 2) {return `Nice! ${streak} days in a row!`;}
  return `Great start! Keep ${activity} going!`;
}

/**
 * Encouraging empty state messages.
 */
export const emptyStates = {
  noActivities: {
    title: 'Your journey starts here',
    subtitle: 'Log your first activity and watch your streaks grow!',
  },
  noStreaks: {
    title: 'Build something amazing',
    subtitle: 'Every streak starts with day one. Log an activity to begin!',
  },
  noLogs: {
    title: 'Nothing logged yet',
    subtitle: 'Tap + to record what you accomplished today.',
  },
  noSchedules: {
    title: 'No plans yet',
    subtitle: 'Set up a schedule to build consistency.',
  },
  searchEmpty: {
    title: 'No matches found',
    subtitle: 'Try a different search or create a new activity.',
  },
} as const;
