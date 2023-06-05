import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import type { RouteConfig, PageLayoutObject, PageLayout } from "./types";
import { isValidPageLayout } from "./types";
import React from "react";

/**
 * This is a function that can be called on a SINGLE `RouteConfig` that will
 * transform it (and it's children) into type `RouteObject`, so that we can
 * pass it to `react-router`'s `useRoutes` hook.
 *
 * Applies all configs to it in the process (wrappers, auth, etc)
 */
const routeConfigToRouteObj = <T extends PageLayoutObject>(
  { wrapper = undefined, ...route_props }: RouteConfig<T>,
  page_layout_map: T,
  fallback_route: string
) => {
  // Return if we don't have an element to wrap
  const hasElement = !!route_props.element;
  // const hasChildren = !!route_props.children && Array.isArray(route_props.children);
  // Route is asking to be wrapped by a wrapper
  if (hasElement && isValidPageLayout(wrapper, page_layout_map)) {
    const Wrapper = page_layout_map[wrapper];
    const original_element = route_props.element;
    route_props.element = <Wrapper>{original_element}</Wrapper>;
  }
  if (!!route_props.children && Array.isArray(route_props.children)) {
    /// Recursive, because we have to do what we just did for all the children
    /// Ignore undefined children if top level isn't nested
    route_props.children = route_props.children.map((d) =>
      routeConfigToRouteObj(d, page_layout_map, fallback_route)
    );
  }
  return route_props as RouteObject;
};

/**
 * A function that turns a list of RouteConfigs into Route Objects,
 * applying all configs to it in the process (wrappers, auth, etc)
 */
export const createRoutes = <
  PageLayouts extends PageLayoutObject,
  PageLayoutKeys = PageLayout<PageLayouts>
>({
  routes,
  layouts,
  fallback_route,
}: {
  /** The RoutesConfig object to generate routes from  */
  routes: RouteConfig<PageLayouts>[];
  /** The Record<string, Function> to use to wrap routes */
  layouts: PageLayouts;
  /** The Route to fallback to if we're unauthenticated */
  fallback_route: string;
  /** A react hook that returns true if we're authenticated */
}) => {
  const FALLBACK_ROUTE = fallback_route; // route we redirect to if not logged in
  return routes.map((route: RouteConfig<PageLayouts>) =>
    routeConfigToRouteObj<PageLayouts>(route, layouts, FALLBACK_ROUTE)
  ) as RouteObject[];
};
