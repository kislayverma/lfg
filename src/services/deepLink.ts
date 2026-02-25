/**
 * Deep link generation and parsing for sharing activities.
 *
 * URL format:
 *   lfg://share?name=Gym&rrule=FREQ%3DWEEKLY%3BBYDAY%3DMO%2CWE%2CFR&time=07%3A00&duration=60
 */

const SCHEME = 'lfg';
const HOST = 'share';

export interface SharePayload {
  name: string;
  rrule: string;
  time: string; // HH:mm
  duration: number; // minutes
}

/**
 * Builds a deep link URL encoding the activity schedule.
 */
export function buildShareLink(payload: SharePayload): string {
  const params = new URLSearchParams({
    name: payload.name,
    rrule: payload.rrule,
    time: payload.time,
    duration: String(payload.duration),
  });
  return `${SCHEME}://${HOST}?${params.toString()}`;
}

/**
 * Parses a deep link URL into a SharePayload.
 * Returns null if the URL is not a valid share link.
 */
export function parseShareLink(url: string): SharePayload | null {
  try {
    // Handle both lfg://share?... and https://lfghabits.app/share?...
    let queryString: string | undefined;

    if (url.startsWith(`${SCHEME}://`)) {
      const afterScheme = url.slice(`${SCHEME}://`.length);
      const questionIdx = afterScheme.indexOf('?');
      if (questionIdx === -1) {
        return null;
      }
      queryString = afterScheme.slice(questionIdx + 1);
    } else if (url.includes('/share?')) {
      queryString = url.split('/share?')[1];
    } else {
      return null;
    }

    if (!queryString) {
      return null;
    }

    const params = new URLSearchParams(queryString);
    const name = params.get('name');
    const rrule = params.get('rrule');
    const time = params.get('time');
    const duration = params.get('duration');

    if (!name || !rrule || !time || !duration) {
      return null;
    }

    return {
      name,
      rrule,
      time,
      duration: parseInt(duration, 10),
    };
  } catch {
    return null;
  }
}

/**
 * Builds a human-readable share message including the deep link.
 */
export function buildShareMessage(payload: SharePayload): string {
  const link = buildShareLink(payload);
  return `Join me on "${payload.name}" with LFG \u{1F680}! Tap to add it to your calendar:\n${link}`;
}
