import { ThemeProvider as MuiThemeProvider, CssBaseline, createTheme } from '@mui/material';
import '@fontsource/pacifico';
import '@fontsource/inter';
import cursor from '../../assets/Images/cursor-dragon-scimitar.png';

/**
 * @see https://bareynol.github.io/mui-theme-creator/
 */
export const darkTheme = createTheme({
  palette: {
    // Without an explicit mode, MUI components that read the palette directly —
    // Select/Autocomplete menus, Popovers, Tooltips, Menus — fall back to MUI's
    // *light* defaults (white background.paper) while this theme's typography
    // forces white text everywhere (see `allVariants` below). That combination is
    // the white-on-white/light-gray "can't read the options" bug: the popped-out
    // menu itself was never actually themed dark, only the in-page Cards were
    // (via per-component overrides). `mode: 'dark'` plus explicit background/text
    // fixes every Select/Autocomplete/Menu app-wide from one place.
    mode: 'dark',
    primary: {
      main: '#424242',
    },

    secondary: {
      main: '#121212',
    },
    background: {
      default: '#0d0d0d',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#9e9e9e',
    },
  },
  typography: {
    h1: {
      fontFamily: "'pacifico', cursive",
      fontWeight: 300,
      fontSize: '6rem',
      lineHeight: 1,
      letterSpacing: '-0.01562em',
      color: '#fff',
    },
    h2: {
      fontFamily: "'pacifico', cursive",
      color: '#fff',
    },
    h3: {
      fontFamily: "'pacifico', cursive",
    },
    h4: {
      fontFamily: "'pacifico', cursive",
    },
    h5: {
      fontFamily: "'pacifico', cursive",
    },
    h6: {
      fontFamily: "'pacifico', cursive",
    },
    body1: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    allVariants: {
      color: '#fff',
    },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          cursor: `url(${cursor}), auto`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#000',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          backgroundColor: 'transparent',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'black' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
          '& input': { backgroundColor: 'transparent' },
          '& input:-webkit-autofill': {
            WebkitBoxShadow: '0 0 0 1000px transparent inset',
            WebkitTextFillColor: '#ffffff',
            caretColor: '#ffffff',
            transition: 'background-color 5000s ease-in-out 0s',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9e9e9e',
          '&.Mui-focused': { color: '#2A9D8F' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#9e9e9e',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        popupIndicator: {
          color: '#9e9e9e',
        },
        clearIndicator: {
          color: '#9e9e9e',
        },
        paper: {
          backgroundColor: '#1a1a1a',
          backgroundImage: 'none',
        },
        listbox: {
          backgroundColor: '#1a1a1a',
        },
        option: {
          color: '#ffffff',
          '&.Mui-focused, &[aria-selected="true"]': {
            backgroundColor: 'rgba(42,157,143,0.16)',
          },
        },
      },
    },
    // Belt-and-suspenders on top of palette.mode: 'dark' above — Select/Autocomplete
    // menus and any other Popover-based menu render in a portal, so they must be
    // explicitly readable here rather than relying on ad-hoc per-page backgrounds.
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          backgroundImage: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          backgroundImage: 'none',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&.Mui-selected': {
            backgroundColor: 'rgba(42,157,143,0.16)',
          },
          '&.Mui-selected:hover, &:hover': {
            backgroundColor: 'rgba(255,255,255,0.08)',
          },
        },
      },
    },
  },
});

export function ThemeProvider({ children }: React.PropsWithChildren<{}>) {
  return (
    <MuiThemeProvider theme={darkTheme}>
      <CssBaseline>{children}</CssBaseline>
    </MuiThemeProvider>
  );
}
