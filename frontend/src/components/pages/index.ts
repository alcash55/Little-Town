import { lazy } from "react";

export const Pages = {
  TeamData: lazy(() => import("./TeamData")),
  Home: lazy(() => import("./Home")),
  Error: lazy(() => import("./Error")),
  BingoBoard: lazy(() => import("./BingoBoard")),
  TeamProgress: lazy(() => import("./TeamProgress")),
};
