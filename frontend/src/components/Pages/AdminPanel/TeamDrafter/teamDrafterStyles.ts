import { darkTheme } from '../../../../layout/Theme/theme';
import { appColors } from '../../../../layout/Theme/appColors';

// Sprint 6: these used to be page-local copies of the same design tokens
// layout/Theme/appColors.ts defines app-wide — re-exported from there now so
// there's a single source of truth. Kept as named exports (rather than
// switching every consumer to `appColors.*` directly) to avoid a mechanical
// rename across the ~17 files that import these.
export const textPrimary = appColors.textPrimary;
export const textSecondary = appColors.textSecondary;
export const mutedText = appColors.mutedText;
export const subtleBorder = appColors.cardBorder;

/** Mirrors useBingoDetails inputSx */
export const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: textPrimary,
    backgroundColor: 'transparent',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: subtleBorder },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
    '& input': { backgroundColor: 'transparent' },
    '& textarea': { backgroundColor: 'transparent' },
  },
  '& .MuiInputBase-input::placeholder': {
    color: mutedText,
    opacity: 1,
  },
  '& .MuiInputLabel-root': {
    color: textSecondary,
    '&.Mui-focused': { color: '#2A9D8F' },
  },
};

export const cardSx = {
  backgroundColor: darkTheme.palette.secondary.main,
  color: textPrimary,
  width: '100%',
};

export const tableCellSx = {
  color: textPrimary,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

export const outlinedButtonSx = {
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.38)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
};

export const selectSx = {
  minWidth: 150,
  color: textPrimary,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: subtleBorder },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
  '& .MuiSelect-icon': { color: textSecondary },
};

export const teamDrafterTabsSx = {
  borderBottom: '1px solid rgba(255,255,255,0.15)',
  width: '100%',
  mb: 2,
  '& .MuiTab-root': {
    color: textSecondary,
    fontFamily: "'Inter', sans-serif",
    textTransform: 'none',
    fontSize: 15,
    minHeight: 44,
    '&:hover': {
      color: textPrimary,
    },
  },
  '& .MuiTab-root.Mui-selected': {
    color: '#2A9D8F',
  },
  '& .MuiTabs-indicator': {
    backgroundColor: '#2A9D8F',
  },
};
