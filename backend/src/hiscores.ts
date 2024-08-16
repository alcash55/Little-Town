import { skills, activities } from "./utils/responseList.js";

/**
 * @see https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
 * @returns {Promise<string>}
 */
export async function hiscores(rsn) {
  async function getHiscoreData() {
    try {
      const response = await fetch(
        `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${rsn}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.text();
    } catch (e) {
      console.log(e);
      throw new Error(e);
    }
  }

  /**
   * Takes all types of skills/categories and formats them into an array of objects
   * that each object has a skills/category object has three properties rank, level, and experience
   * @returns {object[]}
   */
  function formatHiscoresOptions() {
    let formattedActivites: {
      [key: string]: { rank: number; level: number; experience: number };
    } = {};

    let formattedSkills: {
      [key: string]: { rank: number; experience: number };
    } = {};

    // Populate formattedActivities
    activities.forEach((activity) => {
      formattedActivites[activity] = {
        rank: 0,
        level: 0,
        experience: 0,
      };
    });

    // Populate formattedSkills
    skills.forEach((skill) => {
      formattedSkills[skill] = {
        rank: 0,
        experience: 0,
      };
    });

    return {
      ...formattedSkills,
      ...formattedActivites,
    };
  }

  /**
   * @param {string[]} hiscoreData - The raw hiscore data as a string.
   * @param {object} formattedOptions - activitis & skills object.
   * @returns {object} - activities & skills object with hiscore data.
   */
  function parseHiscores(hiscoreData, formattedOptions) {
    const formattedHiscores = hiscoreData.trim().split("\n");

    formattedHiscores.forEach((line, idx) => {
      // Split the line into parts
      const [rankStr, levelStr, experienceStr] = line.split(",").map(Number);

      // Check if the index is valid in the formattedOptions
      const key = Object.keys(formattedOptions)[idx];

      // If the key is valid, update its data
      if (key) {
        formattedOptions[key] = {
          // rank: rankStr,
          level: levelStr === -1 ? "unranked" : levelStr, // -1 as unranked
          experience: experienceStr,
        };
      }
    });

    return formattedOptions;
  }

  function filterHiscoresforBingo(data) {
    console.log(data);
  }

  async function sendHiscorestoDB(data) {
    console.log(data);
  }

  try {
    const hiscoreData = await getHiscoreData();
    const formattedOptions = formatHiscoresOptions();
    const parsedData = parseHiscores(hiscoreData, formattedOptions);
    const filteredData = filterHiscoresforBingo(parsedData);
    const sentData = await sendHiscorestoDB(filteredData);

    return filteredData;
  } catch (e) {
    console.log(e);
  }
}
