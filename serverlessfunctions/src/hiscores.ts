// https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
export const hiscores = async (rsn) => {
  const formattedResponse = (response: string) => {
    return response;
  };

  const response = await fetch(
    `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${rsn}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  ).catch((e) => {
    return e;
  });
  const data = await response.text(); //type string
  return formattedResponse(data);
};
