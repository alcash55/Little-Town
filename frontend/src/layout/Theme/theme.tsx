import {
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  createTheme,
} from "@mui/material";
import "@fontsource/pacifico";
import "@fontsource/inter";

export const darkTheme = createTheme({
  palette: {
    primary: {
      main: "#424242",
    },

    secondary: {
      main: "#121212",
    },
  },
  typography: {
    h1: {
      fontFamily: "'pacifico', cursive",
      fontWeight: 300,
      fontSize: "6rem",
      lineHeight: 1,
      letterSpacing: "-0.01562em",
    },
    body1: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 400,
      fontSize: "1rem",
      lineHeight: 1.5,
      letterSpacing: "0.00938em",
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
