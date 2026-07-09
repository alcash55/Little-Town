import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { FlatSearchResult } from './useResources';
import { textPrimary, textSecondary, accent, subtleBorder } from './resourcesStyles';
import ResourceItemCard from './ResourceItemCard';

interface SearchResultsProps {
  results: FlatSearchResult[];
  query: string;
  onJumpToCategory: (categoryId: string) => void;
}

const PAGE_SIZE = 12;

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  results: FlatSearchResult[];
}

/**
 * Cross-category search results (R2.c), grouped by category with a jump
 * link, revealed a page at a time so a broad query across 14 categories
 * doesn't dump dozens of cards at once.
 */
const SearchResults = ({ results, query, onJumpToCategory }: SearchResultsProps) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const grouped = useMemo<CategoryGroup[]>(() => {
    const byCategory = new Map<string, CategoryGroup>();
    for (const result of results) {
      const existing = byCategory.get(result.category.id);
      if (existing) {
        existing.results.push(result);
      } else {
        byCategory.set(result.category.id, {
          categoryId: result.category.id,
          categoryName: result.category.name,
          results: [result],
        });
      }
    }
    return Array.from(byCategory.values());
  }, [results]);

  if (results.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ color: textPrimary, fontWeight: 600 }}>
          No results for &ldquo;{query}&rdquo;
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary, mt: 0.5 }}>
          Try a different term, or clear the search to browse by category.
        </Typography>
      </Box>
    );
  }

  let shown = 0;

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: textSecondary }}>
        {results.length} result{results.length === 1 ? '' : 's'} across {grouped.length} categor
        {grouped.length === 1 ? 'y' : 'ies'} for &ldquo;{query}&rdquo;
      </Typography>

      {grouped.map((group) => {
        if (shown >= visibleCount) return null;
        const remainingBudget = visibleCount - shown;
        const groupResults = group.results.slice(0, remainingBudget);
        shown += groupResults.length;

        return (
          <Box key={group.categoryId}>
            <Button
              onClick={() => onJumpToCategory(group.categoryId)}
              sx={{
                textTransform: 'none',
                color: accent,
                fontWeight: 700,
                px: 0,
                pb: 1,
                mb: 1,
                borderBottom: `1px solid ${subtleBorder}`,
                borderRadius: 0,
                width: '100%',
                justifyContent: 'flex-start',
              }}
            >
              {group.categoryName} ({group.results.length})
            </Button>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              {groupResults.map(({ item }) => (
                <ResourceItemCard key={item.id} item={item} />
              ))}
            </Box>
          </Box>
        );
      })}

      {visibleCount < results.length && (
        <Button
          variant="outlined"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          sx={{ alignSelf: 'center', color: textPrimary, borderColor: subtleBorder }}
        >
          Show more ({results.length - visibleCount} remaining)
        </Button>
      )}
    </Stack>
  );
};

export default SearchResults;
