import { lazy } from "react";

export const Pages = {
  TeamData: lazy(() => import("./TeamData")),
  Home: lazy(() => import("./Home")),
  Error: lazy(() => import("./Error")),
};
