import { useState, useEffect } from 'react';

export const useBingoScores = async () => {
  let headersList = {
    Accept: '*/*',
    'User-Agent': 'Thunder Client (https://www.thunderclient.com)',
  };

  let response = await fetch(
    'http://services.runescape.com/m=hiscore_oldschool/index_lite.ws?player=lucky%20buck2',
    {
      method: 'GET',
      headers: headersList,
    },
  );

  let data = await response.json();
  console.log(data);

  return data;
};
