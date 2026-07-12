import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ResourceCategory, ResourceItem, ResourceManifest, ResourceSection } from './types';
import resourcesManifest from '../../../data/resources.json';

export interface CategoryGroupEntry {
  group: string;
  categories: ResourceCategory[];
}

export interface FlatSearchResult {
  category: ResourceCategory;
  section: ResourceSection;
  item: ResourceItem;
}

/**
 * Pulls the category id out of a router location hash (`#tob` -> `tob`),
 * tolerating a missing hash or a malformed percent-encoding without
 * throwing.
 */
const readHashCategoryId = (hash: string): string | null => {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * Data source for the Resource Library.
 *
 * Resolves the real `frontend/src/data/resources.json` manifest (statically
 * imported, `resolveJsonModule` is on). Search, category grouping, and image
 * resolution all run off the same DATA CONTRACT shape.
 *
 * The selected category is tracked as `/Resources#<category-id>` (category
 * ids are STABLE, see `frontend/src/data/README.md`) so refresh, deep links,
 * and browser back/forward all resolve to the right category instead of
 * always resetting to the first one. `location.hash` (from react-router's
 * own subscription via `useLocation`) is the single source of truth —
 * `selectedCategoryId` is derived from it on every render rather than kept
 * as separate state, so there's nothing that can desync from the URL.
 */
export function useResources() {
  const location = useLocation();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve(resourcesManifest as ResourceManifest)
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load resources.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => (manifest ? [...manifest.categories].sort((a, b) => a.order - b.order) : []),
    [manifest],
  );

  const defaultCategoryId = categories[0]?.id ?? null;

  // Unknown or absent hash falls back to the default (first) category.
  const selectedCategoryId = useMemo(() => {
    if (categories.length === 0) return null;
    const hashId = readHashCategoryId(location.hash);
    const isValid = hashId !== null && categories.some((category) => category.id === hashId);
    return isValid ? hashId : defaultCategoryId;
  }, [categories, defaultCategoryId, location.hash]);

  const selectCategory = useCallback(
    (categoryId: string) => {
      // REPLACE (not push) so clicking through categories doesn't bury the
      // back button under every stop along the way. This goes through the
      // router's history wrapper (not a raw `location.hash =` assignment),
      // so it won't trigger the browser's native anchor-jump scroll.
      navigate(
        { pathname: location.pathname, search: location.search, hash: categoryId },
        { replace: true },
      );
    },
    [navigate, location.pathname, location.search],
  );

  const groupedCategories = useMemo<CategoryGroupEntry[]>(() => {
    const groups = new Map<string, ResourceCategory[]>();
    for (const category of categories) {
      const key = category.group ?? 'Other';
      const list = groups.get(key);
      if (list) {
        list.push(category);
      } else {
        groups.set(key, [category]);
      }
    }
    return Array.from(groups.entries()).map(([group, groupCategories]) => ({
      group,
      categories: groupCategories,
    }));
  }, [categories]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const searchResults = useMemo<FlatSearchResult[]>(() => {
    if (!isSearching) return [];
    const results: FlatSearchResult[] = [];
    for (const category of categories) {
      for (const section of category.sections) {
        for (const item of section.items) {
          const haystack = `${item.title} ${item.description ?? ''}`.toLowerCase();
          if (haystack.includes(trimmedQuery)) {
            results.push({ category, section, item });
          }
        }
      }
    }
    return results;
  }, [categories, isSearching, trimmedQuery]);

  return {
    loading,
    error,
    categories,
    groupedCategories,
    selectedCategory,
    selectedCategoryId,
    selectCategory,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
  };
}
