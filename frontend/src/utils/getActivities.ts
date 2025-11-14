const BASEURL = import.meta.env.VITE_BASEURL ?? 'http://localhost:3000';
const token = localStorage.getItem('authToken');

export const getActivities = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${BASEURL}/api/hiscores/activities/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }
  } catch (e) {
    throw new Error(`Unable to get activities: ${e}`);
  }
};
