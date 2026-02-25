/**
 * Normalizes an activity name for matching:
 * lowercase, trimmed whitespace.
 */
export function normalizeActivityName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Generates a random hex color for activity display.
 */
const ACTIVITY_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F1948A',
  '#82E0AA',
];

export function randomActivityColor(): string {
  return ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)];
}
