import type { PropsWithChildren } from "react";

import { BrowserRouter as Router } from "react-router-dom";
import { ThemeProvider } from "../Theme";
import { SidebarProvider } from "../../contexts";

export function Providers({ children }: PropsWithChildren<{}>) {
  return (
    <Router basename="/Little-Town">
      <SidebarProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </SidebarProvider>
    </Router>
  );
}
