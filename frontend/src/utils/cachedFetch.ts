/**
 * Fetches data and caches the result in sessionStorage for the tab session.
 * On subsequent calls, returns the cached value immediately without hitting the network.
 * The backend cron job handles data freshness for static data (skills, activities).
 */
export const cachedFetch = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const cached = sessionStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  const data = await fetcher();

  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // sessionStorage quota exceeded (e.g. items list is large) — skip caching
    console.warn(`cachedFetch: could not cache "${key}":`, e);
  }

  return data;
};
