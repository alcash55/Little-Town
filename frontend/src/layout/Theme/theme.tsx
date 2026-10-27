import { ThemeProvider as MuiThemeProvider, CssBaseline, createTheme, alpha } from '@mui/material';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/marcellus';
import { appColors as c } from './appColors';

const heading = { fontFamily: "'Marcellus', Georgia, serif", fontWeight: 400 };
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: c.accent, contrastText: c.onAccent },
    secondary: { main: c.surface, contrastText: c.textPrimary },
    background: { default: c.background, paper: c.surface },
    text: { primary: c.textPrimary, secondary: c.textSecondary },
    divider: c.subtleBorder,
    success: { main: c.completed },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { ...heading, fontSize: '2.5rem', lineHeight: 1.15 },
    h2: { ...heading, fontSize: '1.8rem', lineHeight: 1.25 },
    h3: { ...heading, fontSize: '1.4rem', lineHeight: 1.3 },
    h4: { ...heading, fontSize: '1.3rem' },
    h5: { ...heading, fontSize: '1.2rem' },
    h6: { ...heading, fontSize: '1.1rem' },
    body1: { fontSize: '0.9rem', lineHeight: 1.8 },
    body2: { fontSize: '0.8rem', lineHeight: 1.7 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        a: { color: c.accent },
        ':focus-visible': { outline: `2px solid ${c.accent}`, outlineOffset: 3 },
        '::selection': { background: alpha(c.accent, 0.25) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 4, padding: '10px 16px', minHeight: 40 },
        outlined: { borderColor: c.cardBorder, '&:hover': { backgroundColor: c.raised } },
        contained: { '&.MuiButton-colorPrimary:hover': { backgroundColor: c.accentHover } },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: c.surface,
          border: `1px solid ${c.subtleBorder}`,
          boxShadow: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: c.background,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: c.cardBorder },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: c.accent },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: c.accent },
          '& input:-webkit-autofill': {
            WebkitBoxShadow: `0 0 0 1000px ${c.background} inset`,
            WebkitTextFillColor: c.textPrimary,
          },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: c.textSecondary } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: c.subtleBorder, padding: '14px 16px' },
        head: { color: c.mutedText, fontWeight: 500, backgroundColor: c.surface },
      },
    },
    MuiTabs: { styleOverrides: { root: { borderBottom: `1px solid ${c.subtleBorder}` } } },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          alignItems: 'flex-start',
          padding: '12px 16px',
          minHeight: 48,
        },
      },
    },
    MuiDialog: { styleOverrides: { paper: { border: `1px solid ${c.cardBorder}`, padding: 8 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.85rem', '&.Mui-selected': { backgroundColor: alpha(c.accent, 0.12) } },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 4, alignItems: 'flex-start' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.75rem' } } },
  },
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  return (
    <MuiThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
