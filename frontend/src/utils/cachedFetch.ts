/**
 * Fetches a URL and caches the JSON result in sessionStorage.
 * On subsequent calls within the same session, returns the cached value
 * immediately without hitting the network.
 *
 * @param key     - sessionStorage key to store the result under
 * @param fetcher - async function that returns the data to cache
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
    // sessionStorage quota exceeded (e.g. items list is large) — just skip caching
    console.warn(`cachedFetch: could not cache "${key}":`, e);
  }

  return data;
};
