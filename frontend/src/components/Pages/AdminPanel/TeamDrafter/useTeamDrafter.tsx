export const useTeamDrafter = () => {
  const BASEURL = import.meta.env.VITE_BASEURL ?? 'http://localhost:3000';
  const token = localStorage.getItem('authToken');

  /**
   * Submit completed teams from the draft
   */
  const submitDraft = async (teams: object) => {
    try {
      const submit = await fetch(`${BASEURL}`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(teams),
      });

      if (!submit.ok) {
        throw new Error(`Failed to post draft: ${submit.statusText}`);
      }
    } catch (e) {
      throw new Error(`Unable submit draft: ${e}`);
    }
  };

  return { submitDraft };
};
