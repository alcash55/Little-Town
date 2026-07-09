import { Box, Typography } from '@mui/material';
import { ResourceSection } from './types';
import { textPrimary, subtleBorder } from './resourcesStyles';
import ResourceItemCard from './ResourceItemCard';

interface SectionGroupProps {
  section: ResourceSection;
}

/** One section (e.g. "Guides & videos") within a category, with its items. */
const SectionGroup = ({ section }: SectionGroupProps) => {
  return (
    <Box component="section" aria-labelledby={`section-${section.kind}-${section.title}`}>
      <Typography
        id={`section-${section.kind}-${section.title}`}
        variant="h6"
        sx={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: textPrimary,
          pb: 1,
          mb: 1.5,
          borderBottom: `1px solid ${subtleBorder}`,
        }}
      >
        {section.title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        {section.items.map((item) => (
          <ResourceItemCard key={item.id} item={item} />
        ))}
      </Box>
    </Box>
  );
};

export default SectionGroup;
