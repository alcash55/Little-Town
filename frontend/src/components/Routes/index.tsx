import { useRoutes } from "react-router-dom";
import { routes } from "./routes";

export const AllRoutes = () => {
  const allRoutes = useRoutes(routes);

  return allRoutes;
};
