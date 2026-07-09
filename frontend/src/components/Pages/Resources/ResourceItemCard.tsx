import { useState } from 'react';
import { Box, ButtonBase, Card, CardContent, Stack, Typography } from '@mui/material';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { ResourceItem } from './types';
import { resolveResourceImage } from './imageLoader';
import { cardSx, textPrimary, textSecondary } from './resourcesStyles';
import LinkButton from './LinkButton';
import RuneliteCopyControl from './RuneliteCopyControl';
import ImageLightbox, { LightboxImage } from './ImageLightbox';

interface ResourceItemCardProps {
  item: ResourceItem;
}

/** A single resource entry: title, description, image thumbs, links, RuneLite copy (R2.d). */
const ResourceItemCard = ({ item }: ResourceItemCardProps) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images: LightboxImage[] = (item.images ?? []).map((path) => ({
    src: resolveResourceImage(path) ?? '',
    alt: `${item.title} — image`,
  }));

  return (
    <Card sx={cardSx} component="article" aria-labelledby={`${item.id}-title`}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography id={`${item.id}-title`} variant="body1" sx={{ fontWeight: 600, color: textPrimary }}>
          {item.title}
        </Typography>

        {item.description && (
          <Typography variant="body2" sx={{ color: textSecondary }}>
            {item.description}
          </Typography>
        )}

        {images.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {images.map((image, idx) => (
              <ButtonBase
                key={`${item.id}-img-${idx}`}
                onClick={() => setLightboxIndex(idx)}
                aria-label={`View image ${idx + 1} of ${images.length} for ${item.title} full size`}
                sx={{
                  position: 'relative',
                  width: 96,
                  height: 96,
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '&:hover .zoomHint': { opacity: 1 },
                }}
              >
                {image.src ? (
                  <Box
                    component="img"
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BrokenImageIcon sx={{ color: textSecondary, fontSize: 28 }} />
                  </Box>
                )}
                <Box
                  className="zoomHint"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(0,0,0,0.35)',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <ZoomInIcon sx={{ color: '#fff' }} />
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        )}

        {item.links && item.links.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {item.links.map((link) => (
              <LinkButton key={link.url} link={link} />
            ))}
          </Stack>
        )}

        {item.runelite && <RuneliteCopyControl config={item.runelite} />}
      </CardContent>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </Card>
  );
};

export default ResourceItemCard;
