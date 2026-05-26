import { fetchWithAuth } from './fetchWithAuth';
import { cachedFetch } from './cachedFetch';

const BASEURL = import.meta.env.VITE_BASEURL ?? 'http://localhost:8081';

export const getActivities = (): Promise<string[]> =>
  cachedFetch('osrs:activities', async () => {
    const response = await fetchWithAuth(`${BASEURL}/api/hiscores/activities/list`);
    if (response.ok) return response.json();
    throw new Error(`Failed to fetch activities: ${response.statusText}`);
  });
