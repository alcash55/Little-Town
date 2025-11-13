import { HiscoreData } from "./types/index.js";

/**
 * @see https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
 * @returns {Promise<HiscoreData>}
 */
export async function hiscores(rsn: string): Promise<HiscoreData> {
  async function getHiscoreData(rsn: string): Promise<{
    name: string;
    skills: [
      {
        id: number;
        name: "string";
        rank: number;
        level: number;
        xp: number;
      }
    ];
    activities: [{ id: number; name: "string"; rank: number; score: number }];
  }> {
    try {
      const response = await fetch(
        `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${rsn}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (e) {
      console.error("Error fetching hiscore data:", e);
      throw new Error("Failed to fetch hiscore data");
    }
  }

  /**
   * Takes all types of skills/categories and formats them into an array of objects
   * that each object has a skills/category object with level and experience properties
   * @returns {HiscoreData}
   */
  async function formatHiscoresOptions(unformatedHiscoreData: {
    name: string;
    skills: [
      { id: number; name: "string"; rank: number; level: number; xp: number }
    ];
    activities: [{ id: number; name: "string"; rank: number; score: number }];
  }): Promise<HiscoreData> {
    if (!unformatedHiscoreData) {
      throw new Error("No hiscore data to format");
    }

    const formattedActivities = unformatedHiscoreData.activities.map(
      (activity) => {
        const { id, name, rank, score } = activity;
        return {
          id,
          name,
          rank,
          kc: score,
        };
      }
    );

    return {
      name: unformatedHiscoreData.name,
      skills: unformatedHiscoreData.skills,
      activities: formattedActivities,
      updatedAt: new Date(),
    };
  }

  try {
    const unformatedHiscoreData = await getHiscoreData(rsn);
    const formattedHiscoreData = await formatHiscoresOptions(
      unformatedHiscoreData
    );

    return formattedHiscoreData;
  } catch (e) {
    console.error("Error in hiscores function:", e);
    throw e; // Re-throw to let the caller handle it
  }
}
