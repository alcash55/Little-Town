import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/** Full-screen image lightbox/zoom for item thumbnails (R2.d). */
const ImageLightbox = ({ images, index, onClose, onIndexChange }: ImageLightboxProps) => {
  const image = images[index];
  if (!image) return null;

  const hasMultiple = images.length > 1;
  const goPrev = () => onIndexChange((index - 1 + images.length) % images.length);
  const goNext = () => onIndexChange((index + 1) % images.length);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-label={image.alt}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && hasMultiple) goPrev();
        if (e.key === 'ArrowRight' && hasMultiple) goNext();
      }}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(10,10,10,0.96)',
          boxShadow: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <IconButton
          aria-label="Close image preview"
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>

        {hasMultiple && (
          <IconButton
            aria-label="Previous image"
            onClick={goPrev}
            sx={{ position: 'absolute', left: 8, color: '#fff', zIndex: 1 }}
          >
            <NavigateBeforeIcon fontSize="large" />
          </IconButton>
        )}

        <Box
          component="img"
          src={image.src}
          alt={image.alt}
          sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
        />

        {hasMultiple && (
          <IconButton
            aria-label="Next image"
            onClick={goNext}
            sx={{ position: 'absolute', right: 8, color: '#fff', zIndex: 1 }}
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
        )}

        {hasMultiple && (
          <Typography
            variant="caption"
            sx={{ position: 'absolute', bottom: 8, color: 'rgba(255,255,255,0.72)' }}
          >
            {index + 1} / {images.length}
          </Typography>
        )}
      </Box>
    </Dialog>
  );
};

export default ImageLightbox;
