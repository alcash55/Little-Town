import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  createTheme,
} from "@mui/material";
import type { Theme } from "@mui/material";

export interface IThemeContext {
  type: "dark";
  toggle: () => void;
}

const defaultType = (): "dark" => {
  //only want to support dark theme for now
  return "dark";
};

export const defaultTheme: IThemeContext = {
  type: defaultType(),
  toggle: () => undefined,
};

export const ThemeContext = createContext<IThemeContext>(defaultTheme);

export const darkTheme = createTheme({
  palette: {
    primary: {
      main: "#0052cc",
    },

    secondary: {
      main: "#edf2ff",
    },
  },
});

export function ThemeProvider({ children }: React.PropsWithChildren<{}>) {
  const [theme, setThemeType] = useState<"dark">(defaultType());
  const [ltTheme, setltTheme] = useState<Theme>(
    createTheme({ palette: { mode: theme } })
  );

  useEffect(() => {
    if (theme === ltTheme.palette.mode) return;
    setltTheme(createTheme({ palette: { mode: theme } }));
  }, [theme]);

  const setLocalStorage = useCallback((type: "dark") => {
    localStorage.setItem("theme-type", type);
  }, []);

  const toggle = useCallback(() => {
    const newType = theme !== "dark" ? "dark" : "dark";
    setLocalStorage(newType);
    setThemeType(newType);
  }, [setLocalStorage, setThemeType, theme]);

  return (
    <ThemeContext.Provider value={{ type: theme, toggle }}>
      <MuiThemeProvider theme={ltTheme}>
        <CssBaseline>{children}</CssBaseline>
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
