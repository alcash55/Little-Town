import { Pages } from "../pages";
import { createRoutes } from "./routes-config";

export const routes = createRoutes({
  fallback_route: "/404",
  layouts: {},
  routes: [
    { path: "*", element: <Pages.Error /> },
    {
      path: "/TeamData",
      element: <Pages.TeamData />,
    },
    {
      path: "/",
      element: <Pages.Home />,
    },
  ],
});
