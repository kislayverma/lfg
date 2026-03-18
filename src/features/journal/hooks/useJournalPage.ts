import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {database, JournalPage, JournalLink} from '../../../database';
import {Q} from '@nozbe/watermelondb';
import {useAuthStore} from '../../../stores/authStore';
import {extractWikiLinks} from '../utils/linkExtractor';

/**
 * Loads or creates a journal page by title.
 * Returns the page, content state, and a debounced save function.
 */
export function useJournalPage(title: string, pageType: 'daily' | 'page') {
  const [page, setPage] = useState<JournalPage | null>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleNormalized = title.toLowerCase();

  // Track whether this hook instance is actively editing (has called setContent)
  const isEditingRef = useRef(false);

  // Load or create the page, then observe it for external changes
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let sub: {unsubscribe: () => void} | null = null;

    (async () => {
      const collection = database.get<JournalPage>('journal_pages');
      const existing = await collection
        .query(
          Q.where('user_id', userId),
          Q.where('title_normalized', titleNormalized),
        )
        .fetch();

      if (cancelled) {
        return;
      }

      let thePage: JournalPage;

      if (existing.length > 0) {
        thePage = existing[0];
      } else {
        // Auto-create the page
        await database.write(async () => {
          thePage = await collection.create(p => {
            p.userId = userId;
            p.title = title;
            p.titleNormalized = titleNormalized;
            p.content = '';
            p.pageType = pageType;
            p.isPinned = false;
            p.updatedAt = Date.now();
          });
        });
      }

      if (cancelled) {
        return;
      }

      setPage(thePage!);
      setContent(thePage!.content);
      isEditingRef.current = false;
      setIsLoading(false);

      // Observe the page record so external edits (e.g. from PageEditorScreen)
      // are picked up when navigating back.
      sub = thePage!.observe().subscribe(updated => {
        if (!isEditingRef.current) {
          setContent(updated.content);
        }
      });
    })();

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [userId, titleNormalized, title, pageType]);

  // Debounced save — writes content to DB 500ms after last edit
  const saveContent = useCallback(
    (newContent: string) => {
      isEditingRef.current = true;
      setContent(newContent);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        if (!page) {
          return;
        }

        await database.write(async () => {
          await page.update(p => {
            p.content = newContent;
            p.updatedAt = Date.now();
          });
        });

        // Rebuild link index for this page
        await rebuildLinks(page.id, userId!, newContent);

        // Allow observer to sync again after save completes
        isEditingRef.current = false;
      }, 500);
    },
    [page, userId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Force an immediate save (call before navigating away)
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!page) {
      return;
    }

    await database.write(async () => {
      await page.update(p => {
        p.content = content;
        p.updatedAt = Date.now();
      });
    });

    await rebuildLinks(page.id, userId!, content);
    isEditingRef.current = false;
  }, [page, content, userId]);

  return {page, content, setContent: saveContent, isLoading, flushSave};
}

/**
 * Rebuilds the journal_links for a given page.
 * Diffs existing links against parsed links and batch-updates.
 */
async function rebuildLinks(
  pageId: string,
  userId: string,
  content: string,
): Promise<void> {
  const linkCollection = database.get<JournalLink>('journal_links');

  // Get current links for this page
  const existing = await linkCollection
    .query(Q.where('source_page_id', pageId))
    .fetch();

  const existingTargets = new Set(existing.map(l => l.targetTitleNormalized));
  const newTargets = new Set(extractWikiLinks(content));

  // Links to add (in new but not in existing)
  const toAdd = [...newTargets].filter(t => !existingTargets.has(t));
  // Links to remove (in existing but not in new)
  const toRemove = existing.filter(l => !newTargets.has(l.targetTitleNormalized));

  if (toAdd.length === 0 && toRemove.length === 0) {
    return;
  }

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

/**
 * Returns all pages that link TO a given page title (backlinks).
 */
export function useBacklinks(titleNormalized: string) {
  const [backlinks, setBacklinks] = useState<JournalPage[]>([]);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId || !titleNormalized) {
      setBacklinks([]);
      return;
    }

    const linkCollection = database.get<JournalLink>('journal_links');

    const sub = linkCollection
      .query(
        Q.where('user_id', userId),
        Q.where('target_title_normalized', titleNormalized),
      )
      .observe()
      .subscribe(async links => {
        if (links.length === 0) {
          setBacklinks([]);
          return;
        }

        const sourceIds = [...new Set(links.map(l => l.sourcePageId))];
        const pageCollection = database.get<JournalPage>('journal_pages');
        const pages = await pageCollection
          .query(Q.where('id', Q.oneOf(sourceIds)))
          .fetch();

        setBacklinks(pages);
      });

    return () => sub.unsubscribe();
  }, [userId, titleNormalized]);

  return backlinks;
}

/**
 * Returns all journal pages for the current user, sorted by updated_at desc.
 * Optionally filters by search query.
 */
export function useAllPages(searchQuery?: string) {
  const [pages, setPages] = useState<JournalPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId) {
      setPages([]);
      setIsLoading(false);
      return;
    }

    const collection = database.get<JournalPage>('journal_pages');
    const conditions = [
      Q.where('user_id', userId),
      Q.where('page_type', 'page'),
      Q.sortBy('updated_at', Q.desc),
    ];

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = Q.sanitizeLikeString(searchQuery.trim().toLowerCase());
      conditions.push(Q.where('title_normalized', Q.like(`%${q}%`)));
    }

    const sub = collection
      .query(...conditions)
      .observe()
      .subscribe(result => {
        setPages(result);
        setIsLoading(false);
      });

    return () => sub.unsubscribe();
  }, [userId, searchQuery]);

  return {pages, isLoading};
}

export interface SearchResult {
  page: JournalPage;
  /** Which field matched: 'title', 'content', or 'both' */
  matchType: 'title' | 'content' | 'both';
  /** A short snippet around the first content match, if any */
  snippet: string | null;
}

/**
 * Debounced full-text search across page titles and content.
 * Returns up to `limit` results sorted by relevance (title matches first).
 */
export function useSearchPages(rawQuery: string, limit: number = 20) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const currentUser = useAuthStore(s => s.currentUser);
  const userId = currentUser?.id;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the raw query by 300ms
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const trimmed = rawQuery.trim().toLowerCase();
    if (trimmed.length === 0) {
      setDebouncedQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [rawQuery]);

  useEffect(() => {
    if (!userId || debouncedQuery.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const collection = database.get<JournalPage>('journal_pages');
      const q = Q.sanitizeLikeString(debouncedQuery);

      // Single query: title OR content matches, sorted by updated_at desc
      const pages = await collection
        .query(
          Q.where('user_id', userId),
          Q.or(
            Q.where('title_normalized', Q.like(`%${q}%`)),
            Q.where('content', Q.like(`%${q}%`)),
          ),
          Q.sortBy('updated_at', Q.desc),
          Q.take(limit),
        )
        .fetch();

      if (cancelled) {
        return;
      }

      const mapped: SearchResult[] = pages.map(page => {
        const titleMatch = page.titleNormalized.includes(debouncedQuery);
        const contentLower = page.content.toLowerCase();
        const contentMatch = contentLower.includes(debouncedQuery);

        let snippet: string | null = null;
        if (contentMatch) {
          snippet = buildSnippet(page.content, contentLower, debouncedQuery);
        }

        return {
          page,
          matchType: titleMatch && contentMatch ? 'both' : titleMatch ? 'title' : 'content',
          snippet,
        };
      });

      // Sort: title matches first, then content-only matches
      mapped.sort((a, b) => {
        const aScore = a.matchType === 'title' || a.matchType === 'both' ? 0 : 1;
        const bScore = b.matchType === 'title' || b.matchType === 'both' ? 0 : 1;
        return aScore - bScore;
      });

      setResults(mapped);
      setIsSearching(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, debouncedQuery, limit]);

  return {results, isSearching, hasQuery: rawQuery.trim().length > 0};
}

/**
 * Extracts a ~80-char snippet around the first occurrence of `query` in `content`.
 * Strips markdown formatting for readability.
 */
function buildSnippet(
  content: string,
  contentLower: string,
  query: string,
): string {
  const idx = contentLower.indexOf(query);
  if (idx === -1) {
    return content.slice(0, 80);
  }

  const CONTEXT = 35;
  const start = Math.max(0, idx - CONTEXT);
  const end = Math.min(content.length, idx + query.length + CONTEXT);

  let snippet = content.slice(start, end);

  // Strip markdown syntax
  snippet = snippet.replace(/[#*_~`\[\]]/g, '').trim();

  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < content.length) {
    snippet = snippet + '...';
  }

  return snippet;
}
