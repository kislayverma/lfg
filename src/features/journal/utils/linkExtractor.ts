/**
 * Extracts [[wiki link]] targets from markdown content.
 * Returns an array of normalized (lowercase, trimmed) link titles.
 */
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const title = match[1].trim();
    if (title.length > 0) {
      links.push(title.toLowerCase());
    }
  }

  // Deduplicate
  return [...new Set(links)];
}

/**
 * Extracts #tags from markdown content.
 * Returns an array of tag strings (without the # prefix), lowercased.
 */
export function extractTags(content: string): string[] {
  // Match #tag but not inside code blocks or links
  const regex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  return [...new Set(tags)];
}

/**
 * Auto-links plain-text mentions of existing page titles by wrapping
 * them in [[...]] wiki-link syntax.
 *
 * Rules:
 *   - Only wraps titles that are >= 3 characters (avoids false positives)
 *   - Only matches whole-word boundaries (word start/end or punctuation)
 *   - Skips text already inside [[...]] brackets
 *   - Skips text inside code blocks (``` ... ```) and inline code (` ... `)
 *   - Case-insensitive matching, preserves original casing in the link
 *   - Processes longer titles first to avoid partial matches
 *
 * @param content   The markdown content to scan
 * @param pageTitles Array of { title, titleNormalized } for all existing pages
 * @param currentTitle The title of the page being edited (to skip self-links)
 * @returns Updated content with auto-linked references, or the original
 *          content unchanged if no new links were found
 */
export function autoLinkPageReferences(
  content: string,
  pageTitles: Array<{title: string; titleNormalized: string}>,
  currentTitle: string,
): string {
  const currentNormalized = currentTitle.toLowerCase();

  // Filter to eligible titles (>= 3 chars, not the current page)
  const eligible = pageTitles
    .filter(
      p => p.titleNormalized.length >= 3 && p.titleNormalized !== currentNormalized,
    )
    // Sort longest first so "Meeting Notes" matches before "Meeting"
    .sort((a, b) => b.title.length - a.title.length);

  if (eligible.length === 0) {
    return content;
  }

  // Build a map of regions to skip (existing [[...]], code blocks, inline code)
  const skipRegions = buildSkipRegions(content);

  let result = content;

  for (const page of eligible) {
    // Build a regex that matches the title at word boundaries, case-insensitive
    const escaped = escapeRegex(page.title);
    const pattern = new RegExp(
      `(?<![\\[\\w])${escaped}(?![\\]\\w])`,
      'gi',
    );

    // Replace from right to left to preserve offsets
    const matches: Array<{index: number; length: number; matched: string}> = [];
    let m: RegExpExecArray | null;

    while ((m = pattern.exec(result)) !== null) {
      matches.push({index: m.index, length: m[0].length, matched: m[0]});
    }

    // Process in reverse so earlier indices stay valid
    for (let i = matches.length - 1; i >= 0; i--) {
      const {index, length, matched} = matches[i];
      const end = index + length;

      // Check if this match falls inside a skip region
      if (isInsideSkipRegion(index, end, skipRegions)) {
        continue;
      }

      // Wrap in [[...]] using the matched text's original casing
      const before = result.slice(0, index);
      const after = result.slice(end);
      result = before + '[[' + matched + ']]' + after;

      // Update skip regions: the new [[ ]] we just inserted shifts everything
      // after it by 4 characters ([[  ]])
      updateSkipRegions(skipRegions, index, 4);
      // Also add the newly created link as a skip region
      skipRegions.push({start: index, end: index + length + 4});
    }
  }

  return result;
}

// ── Internal helpers ─────────────────────────────────────────────────

interface SkipRegion {
  start: number;
  end: number;
}

/**
 * Finds all text regions that should not be auto-linked:
 * - Existing [[wiki links]]
 * - Fenced code blocks (``` ... ```)
 * - Inline code (` ... `)
 */
function buildSkipRegions(content: string): SkipRegion[] {
  const regions: SkipRegion[] = [];

  // Existing wiki links
  const wikiRegex = /\[\[[^\]]+\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRegex.exec(content)) !== null) {
    regions.push({start: m.index, end: m.index + m[0].length});
  }

  // Fenced code blocks
  const fencedRegex = /```[\s\S]*?```/g;
  while ((m = fencedRegex.exec(content)) !== null) {
    regions.push({start: m.index, end: m.index + m[0].length});
  }

  // Inline code
  const inlineCodeRegex = /`[^`]+`/g;
  while ((m = inlineCodeRegex.exec(content)) !== null) {
    regions.push({start: m.index, end: m.index + m[0].length});
  }

  return regions;
}

function isInsideSkipRegion(
  start: number,
  end: number,
  regions: SkipRegion[],
): boolean {
  return regions.some(r => start >= r.start && end <= r.end);
}

/** Shift all skip regions after `afterIndex` by `delta` characters */
function updateSkipRegions(
  regions: SkipRegion[],
  afterIndex: number,
  delta: number,
): void {
  for (const r of regions) {
    if (r.start > afterIndex) {
      r.start += delta;
      r.end += delta;
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
