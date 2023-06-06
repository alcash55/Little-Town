import { lazy } from "react";

export const Pages = {
  Bingo: lazy(() => import("./Bingo")),
  Home: lazy(() => import("./Home")),
  Error: lazy(() => import("./Error")),
};
