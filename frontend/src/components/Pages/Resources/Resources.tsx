import { Alert, Box, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { useResources } from './useResources';
import CategoryNav from './CategoryNav';
import SectionGroup from './SectionGroup';
import SearchResults from './SearchResults';
import { searchInputSx, textPrimary, textSecondary } from './resourcesStyles';

/**
 * Resource Library — OSRS boss/activity resources page (Story R2).
 * Category-first navigation with client-side search, image lightbox, and
 * copy-to-clipboard RuneLite configs. See TEAM-BRIEF-RESOURCES.md for the
 * DATA CONTRACT this builds against.
 */
const Resources = () => {
  const {
    loading,
    error,
    groupedCategories,
    selectedCategory,
    selectedCategoryId,
    selectCategory,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
  } = useResources();

  const handleJumpToCategory = (categoryId: string) => {
    selectCategory(categoryId);
    setSearchQuery('');
  };

  if (loading) {
    return (
      <PageLayout title="Resources" align="center">
        <CircularProgress sx={{ color: '#2A9D8F' }} />
        <Typography variant="body2" sx={{ color: textSecondary, mt: 2 }}>
          Loading resources…
        </Typography>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Resources" align="center">
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
          {error}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Resources" maxWidth="full">
      <TextField
        placeholder="Search guides, markers, tools…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        size="small"
        fullWidth
        sx={{ maxWidth: 480, ...searchInputSx }}
        inputProps={{ 'aria-label': 'Search resources by title or description' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: textSecondary }} />
            </InputAdornment>
          ),
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          width: '100%',
          alignItems: 'flex-start',
        }}
      >
        <CategoryNav
          groupedCategories={groupedCategories}
          selectedCategoryId={selectedCategoryId}
          onSelect={handleJumpToCategory}
        />

        <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
          {isSearching ? (
            <SearchResults results={searchResults} query={searchQuery.trim()} onJumpToCategory={handleJumpToCategory} />
          ) : selectedCategory ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: textPrimary }}>
                {selectedCategory.name}
              </Typography>
              {selectedCategory.sections.length === 0 ? (
                <Typography variant="body2" sx={{ color: textSecondary }}>
                  No resources in this category yet.
                </Typography>
              ) : (
                selectedCategory.sections.map((section) => (
                  <SectionGroup key={`${selectedCategory.id}-${section.kind}-${section.title}`} section={section} />
                ))
              )}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: textSecondary }}>
              No categories available yet.
            </Typography>
          )}
        </Box>
      </Box>
    </PageLayout>
  );
};

export default Resources;
