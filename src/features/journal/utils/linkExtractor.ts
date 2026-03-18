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
