import { ThemeProvider as MuiThemeProvider, CssBaseline, createTheme } from '@mui/material';
import '@fontsource/pacifico';
import '@fontsource/inter';
import cursor from '../../assets/Images/cursor-dragon-scimitar.png';

/**
 * @see https://bareynol.github.io/mui-theme-creator/
 */
export const darkTheme = createTheme({
  palette: {
    primary: {
      main: '#424242',
    },

    secondary: {
      main: '#121212',
    },
  },
  typography: {
    h1: {
      fontFamily: "'pacifico', cursive",
      fontWeight: 300,
      fontSize: '6rem',
      lineHeight: 1,
      letterSpacing: '-0.01562em',
      color: '#fff'
    },
    h2: {
      fontFamily: "'pacifico', cursive",
      color: '#fff'
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
      color: '#fff'
    }
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
        }
      }
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
