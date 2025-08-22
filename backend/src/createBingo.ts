import { BingoConfig } from "./types/index.js";

export async function createBingo(data: BingoConfig): Promise<BingoConfig> {
  async function sendBingoConfigToDB(
    bingoData: BingoConfig
  ): Promise<BingoConfig> {
    try {
      // TODO: Implement actual database insertion
      console.log("Saving bingo config to database:", bingoData);

      // Simulate database save with generated ID and timestamps
      const savedBingo: BingoConfig = {
        ...bingoData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return savedBingo;
    } catch (e) {
      console.error("Error saving bingo config to database:", e);
      throw new Error(
        `Failed to save bingo config: ${
          e instanceof Error ? e.message : "Unknown error"
        }`
      );
    }
  }

  try {
    // Validate required fields
    if (!data.name || !data.startDate || !data.endDate) {
      throw new Error("Name, start date, and end date are required");
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date format");
    }

    if (startDate >= endDate) {
      throw new Error("Start date must be before end date");
    }

    const response = await sendBingoConfigToDB(data);
    return response;
  } catch (e) {
    console.error("Error in createBingo function:", e);
    throw e; // Re-throw to let the caller handle it
  }
}
