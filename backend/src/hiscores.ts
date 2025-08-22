import { skills, activities } from "./utils/responseList.js";
import { HiscoreData } from "./types/index.js";

/**
 * @see https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
 * @returns {Promise<HiscoreData>}
 */
export async function hiscores(rsn: string): Promise<HiscoreData> {
  async function getHiscoreData(): Promise<string> {
    try {
      const response = await fetch(
        `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(
          rsn
        )}`,
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

      return response.text();
    } catch (e) {
      console.error("Error fetching hiscore data:", e);
      throw new Error(
        `Failed to fetch hiscore data for ${rsn}: ${
          e instanceof Error ? e.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Takes all types of skills/categories and formats them into an array of objects
   * that each object has a skills/category object with level and experience properties
   * @returns {HiscoreData}
   */
  function formatHiscoresOptions(): HiscoreData {
    const formattedActivities: HiscoreData = {};
    const formattedSkills: HiscoreData = {};

    // Populate formattedActivities
    activities.forEach((activity) => {
      formattedActivities[activity] = {
        level: 0,
        experience: 0,
      };
    });

    // Populate formattedSkills
    skills.forEach((skill) => {
      formattedSkills[skill] = {
        level: 0,
        experience: 0,
      };
    });

    return {
      ...formattedSkills,
      ...formattedActivities,
    };
  }

  /**
   * @param {string} hiscoreData - The raw hiscore data as a string.
   * @param {HiscoreData} formattedOptions - activities & skills object.
   * @returns {HiscoreData} - activities & skills object with hiscore data.
   */
  function parseHiscores(
    hiscoreData: string,
    formattedOptions: HiscoreData
  ): HiscoreData {
    const formattedHiscores = hiscoreData.trim().split("\n");

    formattedHiscores.forEach((line, idx) => {
      // Split the line into parts
      const [rankStr, levelStr, experienceStr] = line.split(",").map(Number);

      // Check if the index is valid in the formattedOptions
      const key = Object.keys(formattedOptions)[idx];

      // If the key is valid, update its data
      if (key) {
        formattedOptions[key] = {
          level: levelStr === -1 ? "unranked" : levelStr, // -1 as unranked
          experience: experienceStr,
        };
      }
    });

    return formattedOptions;
  }

  function filterHiscoresForBingo(data: HiscoreData): HiscoreData {
    // TODO: Implement bingo-specific filtering logic
    console.log("Filtering hiscores for bingo:", data);
    return data;
  }

  async function sendHiscoresToDB(data: HiscoreData): Promise<void> {
    // TODO: Implement database storage
    console.log("Sending hiscores to database:", data);
  }

  try {
    const hiscoreData = await getHiscoreData();
    const formattedOptions = formatHiscoresOptions();
    const parsedData = parseHiscores(hiscoreData, formattedOptions);
    const filteredData = filterHiscoresForBingo(parsedData);

    // Don't await this as it's not critical for the response
    sendHiscoresToDB(filteredData).catch(console.error);

    return filteredData;
  } catch (e) {
    console.error("Error in hiscores function:", e);
    throw e; // Re-throw to let the caller handle it
  }
}
