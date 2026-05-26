import { fetchWithAuth } from './fetchWithAuth';
import { cachedFetch } from './cachedFetch';

const BASE_URL = import.meta.env.VITE_BASEURL ?? 'http://localhost:8081';

export const getSkills = (): Promise<string[]> =>
  cachedFetch('osrs:skills', async () => {
    const response = await fetchWithAuth(`${BASE_URL}/api/hiscores/skills/list`);
    if (response.ok) return response.json();
    throw new Error(`Failed to fetch skills: ${response.statusText}`);
  });
