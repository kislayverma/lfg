/**
 * Share Inbox — bridge between native share extensions and the JS journal.
 *
 * Native share extensions (iOS Share Extension, Android ShareReceiverActivity)
 * write shared highlight items to a platform-specific inbox:
 *
 *   - iOS: Shared MMKV store (via App Group) — because the Share Extension
 *     runs in a separate process.
 *   - Android: A JSON file in the app's files directory — because
 *     ShareReceiverActivity runs in the same process and react-native-mmkv
 *     doesn't expose the raw MMKV SDK to native Kotlin code.
 *
 * When the main app comes to the foreground, `processShareInbox()` reads
 * pending items and funnels each one through the standard journal pipeline:
 *
 *   1. Get or create today's daily note
 *   2. Append a blockquote with the highlighted text + source
 *   3. Run auto-linking (rebuildLinks)
 *   4. Log note-taking activity for streaks
 */

import {createMMKV} from 'react-native-mmkv';
import {Platform} from 'react-native';
import * as RNFS from 'react-native-fs';
import {database, JournalPage, JournalLink} from '../../../database';
import {Q} from '@nozbe/watermelondb';
import {useAuthStore} from '../../../stores/authStore';
import {extractWikiLinks, autoLinkPageReferences} from '../utils/linkExtractor';
import {logActivity} from '../../../hooks/useActivities';
import {formatDateKey} from '../../../utils/date';

// ── Inbox data types ────────────────────────────────────────────────

export interface ShareInboxItem {
  /** The shared/highlighted text */
  text: string;
  /** Source URL (web articles) or book name (Kindle) */
  source?: string;
  /** Subject line from the share intent (often page title) */
  subject?: string;
  /** Timestamp when the item was shared */
  timestamp: number;
}

// ── iOS: Shared MMKV instance ───────────────────────────────────────

const INBOX_KEY = 'share_inbox';

/**
 * MMKV instance shared between the main app and the iOS Share Extension
 * via App Group `group.com.lfg.shared`. Only created on iOS.
 */
const sharedMMKV =
  Platform.OS === 'ios'
    ? createMMKV({
        id: 'lfg.share-inbox',
        mode: 'multi-process',
      })
    : null;

// ── Android: JSON file inbox ────────────────────────────────────────

const ANDROID_INBOX_FILE = 'share_inbox.json';

/**
 * Returns the full path to the Android inbox file.
 * Uses the app's internal files directory (same as Kotlin `filesDir`).
 */
function androidInboxPath(): string {
  return `${RNFS.DocumentDirectoryPath}/${ANDROID_INBOX_FILE}`;
}

// ── Platform-agnostic inbox read/write ──────────────────────────────

async function readInbox(): Promise<ShareInboxItem[]> {
  if (Platform.OS === 'ios') {
    const raw = sharedMMKV?.getString(INBOX_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Android: read from JSON file
  try {
    const filePath = androidInboxPath();
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      return [];
    }
    const raw = await RNFS.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function clearInbox(): Promise<void> {
  if (Platform.OS === 'ios') {
    sharedMMKV?.remove(INBOX_KEY);
    return;
  }

  // Android: delete the file
  try {
    const filePath = androidInboxPath();
    const exists = await RNFS.exists(filePath);
    if (exists) {
      await RNFS.unlink(filePath);
    }
  } catch {
    // Non-critical
  }
}

// ── Inbox processor ─────────────────────────────────────────────────

/**
 * Processes all pending share inbox items:
 *   1. Reads items from the platform-specific inbox
 *   2. For each item, appends to today's daily note
 *   3. Runs auto-linking and link rebuilding
 *   4. Clears the inbox
 *   5. Logs note-taking activity for streaks
 *
 * This is called from the journal plugin's `onForeground` hook.
 */
export async function processShareInbox(): Promise<void> {
  const items = await readInbox();
  if (items.length === 0) {
    return;
  }

  const userId = useAuthStore.getState().currentUser?.id;
  if (!userId) {
    return;
  }

  // Get or create today's daily note
  const today = formatDateKey(new Date());
  const titleNormalized = today.toLowerCase();
  const pageCollection = database.get<JournalPage>('journal_pages');

  let dailyPage: JournalPage;

  const existing = await pageCollection
    .query(
      Q.where('user_id', userId),
      Q.where('title_normalized', titleNormalized),
    )
    .fetch();

  if (existing.length > 0) {
    dailyPage = existing[0];
  } else {
    await database.write(async () => {
      dailyPage = await pageCollection.create(p => {
        p.userId = userId;
        p.title = today;
        p.titleNormalized = titleNormalized;
        p.content = '';
        p.pageType = 'daily';
        p.isPinned = false;
        p.updatedAt = Date.now();
      });
    });
  }

  // Build the text block to append
  const blocks = items.map(item => formatHighlightBlock(item));
  const appendText = '\n' + blocks.join('\n\n') + '\n';

  // Append to the daily note content
  const newContent = dailyPage!.content + appendText;

  await database.write(async () => {
    await dailyPage!.update(p => {
      p.content = newContent;
      p.updatedAt = Date.now();
    });
  });

  // Run auto-linking on the updated content
  await rebuildLinksForPage(dailyPage!.id, userId, newContent, today);

  // Clear the inbox now that items are processed
  await clearInbox();

  // Log note-taking activity for streak tracking
  try {
    await logActivity({
      name: 'Note Taking',
      date: new Date(),
      source: 'manual',
    });
  } catch {
    // Non-critical — don't fail the inbox processing
  }

  console.log(
    `[ShareInbox] Processed ${items.length} shared item(s) into daily note ${today}`,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Formats a shared highlight into a markdown blockquote with source attribution
 * and a [[Highlights]] tag.
 *
 * Format:
 *   [[Highlights]]
 *   > highlighted text
 *   — [example.com](https://example.com/article)   (web URL)
 *   — *Book Name*                                    (non-URL source)
 */
function formatHighlightBlock(item: ShareInboxItem): string {
  // Tag every highlight to the Highlights page (before the quote)
  let block = '[[Highlights]]';

  // Wrap text in blockquote
  const quotedLines = item.text
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');

  block += '\n' + quotedLines;

  // Add source attribution as plain text (outside the blockquote)
  if (item.source) {
    const isUrl =
      item.source.startsWith('http://') || item.source.startsWith('https://');
    if (isUrl) {
      // Strip text fragment (#:~:text=...) — we already have the highlighted text
      const cleanUrl = stripTextFragment(item.source);
      const displayName = extractDomainName(cleanUrl);
      block += `\n— [${displayName}](${cleanUrl})`;
    } else {
      block += `\n— *${item.source}*`;
    }
  } else if (item.subject) {
    block += `\n— *${item.subject}*`;
  }

  return block;
}

/**
 * Extracts a human-readable domain name from a URL.
 * e.g. "https://www.nytimes.com/2024/article" → "nytimes.com"
 */
function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Strip leading "www."
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Strips the text fragment directive (#:~:text=...) from a URL.
 * Browsers add this to highlight selected text on a page, but we
 * already store the highlighted text separately.
 */
function stripTextFragment(url: string): string {
  return url.replace(/#:~:text=.*$/, '');
}

/**
 * Rebuilds auto-links and journal_links for a page.
 * Extracted from useJournalPage to be callable outside React hooks.
 */
async function rebuildLinksForPage(
  pageId: string,
  userId: string,
  content: string,
  pageTitle: string,
): Promise<void> {
  const pageCollection = database.get<JournalPage>('journal_pages');
  const linkCollection = database.get<JournalLink>('journal_links');

  // Load all existing page titles for auto-linking
  const allPages = await pageCollection
    .query(Q.where('user_id', userId), Q.where('page_type', 'page'))
    .fetch();

  const pageTitles = allPages.map(p => ({
    title: p.title,
    titleNormalized: p.titleNormalized,
  }));

  // Auto-link plain-text references to existing pages
  const linkedContent = autoLinkPageReferences(content, pageTitles, pageTitle);

  // If auto-linking changed the content, persist the update
  if (linkedContent !== content) {
    const page = await pageCollection.find(pageId);
    await database.write(async () => {
      await page.update(p => {
        p.content = linkedContent;
        p.updatedAt = Date.now();
      });
    });
  }

  // Extract wiki links from the (possibly modified) content
  const existingLinks = await linkCollection
    .query(Q.where('source_page_id', pageId))
    .fetch();

  const existingTargets = new Set(
    existingLinks.map(l => l.targetTitleNormalized),
  );
  const newTargets = new Set(extractWikiLinks(linkedContent));

  const toAdd = [...newTargets].filter(t => !existingTargets.has(t));
  const toRemove = existingLinks.filter(
    l => !newTargets.has(l.targetTitleNormalized),
  );

  if (toAdd.length > 0 || toRemove.length > 0) {
    await database.write(async () => {
      await database.batch(
        ...toAdd.map(target =>
          linkCollection.prepareCreate(l => {
            l.userId = userId;
            l.sourcePageId = pageId;
            l.targetTitleNormalized = target;
          }),
        ),
        ...toRemove.map(l => l.prepareDestroyPermanently()),
      );
    });
  }
}
