import { RouteObject } from 'react-router-dom';

export type PageLayoutObject<T extends Record<string, Function> = Record<string, Function>> = T;
/// A type that is equal to any key of the pageLayoutMap object that defines
/// the types of wrappers we can use for a route
export type PageLayout<T extends PageLayoutObject = PageLayoutObject<Record<string, Function>>> =
  keyof T;

/// Extend the RouteObject exported from ReactRouter to include extra properties
/// the lets us do:
export interface RouteConfig<E extends PageLayoutObject> extends Omit<RouteObject, 'children'> {
  // What component from pageLayoutMap we should use to wrap this page
  wrapper?: keyof E;
  // Make sure child routes have same format as RouteConfig instead of RouteObject
  children?: RouteConfig<E>[];
}

/** Type guard to make sure that the page layout is accepted  */
export const isValidPageLayout = <T extends PageLayoutObject>(
  p: PageLayout<T> | undefined | any,
  pageLayoutMap: T,
): p is PageLayout<T> => {
  const pExists = !!p;
  if (pExists && p in pageLayoutMap) return true;
  else return false;
};
