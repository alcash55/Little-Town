import { lazy } from "react";

export const Pages = {
  Bingo: lazy(() => import("./TeamData")),
  Home: lazy(() => import("./Home")),
  Error: lazy(() => import("./Error")),
};
