import { textPrimary, textSecondary, subtleBorder } from '../AdminPanel/TeamDrafter/teamDrafterStyles';

export { textPrimary, textSecondary, subtleBorder };

export const accent = '#2A9D8F';
export const mutedText = 'rgba(255,255,255,0.52)';

export const railSx = {
  border: `1px solid ${subtleBorder}`,
  borderRadius: 1,
  bgcolor: 'rgba(255,255,255,0.03)',
};

export const categoryButtonSx = (selected: boolean) => ({
  justifyContent: 'flex-start',
  textAlign: 'left' as const,
  textTransform: 'none' as const,
  color: selected ? accent : textPrimary,
  bgcolor: selected ? 'rgba(42,157,143,0.14)' : 'transparent',
  borderRadius: 1,
  px: 1.25,
  py: 0.75,
  fontWeight: selected ? 600 : 400,
  '&:hover': {
    bgcolor: selected ? 'rgba(42,157,143,0.2)' : 'rgba(255,255,255,0.06)',
  },
});

export const groupLabelSx = {
  color: mutedText,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  px: 1.25,
  mt: 1.5,
  mb: 0.5,
};

export const cardSx = {
  border: `1px solid ${subtleBorder}`,
  borderRadius: 1.5,
  bgcolor: 'rgba(255,255,255,0.03)',
  width: '100%',
};

export const searchInputSx = {
  '& .MuiOutlinedInput-root': {
    color: textPrimary,
    backgroundColor: 'transparent',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: subtleBorder },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: accent },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
  },
};

export const linkKindChipSx = {
  color: textPrimary,
  borderColor: subtleBorder,
  textTransform: 'none' as const,
  '&:hover': { borderColor: accent, bgcolor: 'rgba(42,157,143,0.08)' },
};
