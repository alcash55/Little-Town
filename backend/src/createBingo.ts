export async function createBingo(data) {
  async function sendBingoConfigToDB() {
    try {
      console.log(data);
    } catch (e) {
      console.log(e);
    }
  }

  try {
    const response = await sendBingoConfigToDB();
    return response;
  } catch (e) {
    console.log(e);
  }
}
