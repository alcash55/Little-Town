import { Box, Button, Typography } from '@mui/material';
import { CategoryGroupEntry } from './useResources';
import { categoryButtonSx, groupLabelSx, railSx } from './resourcesStyles';

interface CategoryNavProps {
  groupedCategories: CategoryGroupEntry[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}

/**
 * Category-first navigation rail (R2.b) — pick a boss/activity, see its
 * sections. Vertical grouped list on sm+, horizontal scroll strip on xs so
 * it never eats the whole viewport on mobile.
 */
const CategoryNav = ({ groupedCategories, selectedCategoryId, onSelect }: CategoryNavProps) => {
  return (
    <Box
      component="nav"
      aria-label="Boss and activity categories"
      sx={{
        ...railSx,
        display: 'flex',
        flexDirection: { xs: 'row', sm: 'column' },
        overflowX: { xs: 'auto', sm: 'visible' },
        overflowY: { xs: 'visible', sm: 'auto' },
        gap: { xs: 1, sm: 0 },
        p: 1,
        width: { xs: '100%', sm: 240 },
        flexShrink: 0,
        maxHeight: { sm: '100%' },
      }}
    >
      {groupedCategories.map(({ group, categories }) => (
        <Box
          key={group}
          sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, gap: { xs: 1, sm: 0 } }}
        >
          <Typography component="p" sx={{ ...groupLabelSx, display: { xs: 'none', sm: 'block' } }}>
            {group}
          </Typography>
          {categories.map((category) => {
            const selected = category.id === selectedCategoryId;
            return (
              <Button
                key={category.id}
                type="button"
                disableRipple
                onClick={() => onSelect(category.id)}
                aria-current={selected ? 'page' : undefined}
                sx={{
                  ...categoryButtonSx(selected),
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {category.name}
              </Button>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

export default CategoryNav;
