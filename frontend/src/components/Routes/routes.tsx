import { Pages } from "../pages";
import { createRoutes } from "./routes-config";

const basename = "culinarist.github.io/lt-event-app/";
export const routes = createRoutes({
  fallback_route: "/404",
  layouts: {},
  routes: [
    { path: "*", element: <Pages.Error /> },
    {
      path: `${basename}/bingo`,
      element: <Pages.Bingo />,
    },
    {
      path: `${basename}/`,
      element: <Pages.Home />,
    },
  ],
});
