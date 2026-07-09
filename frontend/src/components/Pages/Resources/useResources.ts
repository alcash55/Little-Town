import { useEffect, useMemo, useState } from 'react';
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
 * Data source for the Resource Library.
 *
 * Resolves the real `frontend/src/data/resources.json` manifest (statically
 * imported, `resolveJsonModule` is on). Search, category grouping, and image
 * resolution all run off the same DATA CONTRACT shape.
 */
export function useResources() {
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve(resourcesManifest as ResourceManifest)
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        const firstId = [...data.categories].sort((a, b) => a.order - b.order)[0]?.id ?? null;
        setSelectedCategoryId((current) => current ?? firstId);
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
    selectCategory: setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
  };
}
