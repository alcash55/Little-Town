const iconMap = [
  { name: 'Barrows', replaceMentName: 'Dharok_the_Wretched' },
  { name: 'Grotesque Guardians', replaceMentName: 'Dusk' },
  { name: 'Chambers of Xeric', replaceMentName: 'Great_Olm' },
  { name: 'Theatre of Blood', replaceMentName: 'Verzik_Vitur' },
  { name: 'Tombs of Amascut', replaceMentName: 'Tumeken%27s_Warden_%28level-489%29' },
  { name: 'Alchemical Hydra', replaceMentName: 'Alchemical_Hydra_%28serpentine%29' },
  { name: 'Dagannoth Kings', replaceMentName: 'Dagannoth_Supreme' },
  { name: 'Phantom Mustpah', replaceMentName: 'Phantom_Muspah_%28ranged%29' },
  { name: 'Zulrah', replaceMentName: 'Zulrah_%28serpentine%29' },
];

/**
 * Set the icon url based on the boss name
 * @param {string} name - the name of the boss
 * @param {void} setSelectedBoss - set the selected boss
 * @param {string} type - from type either A or B
 * @param {void} setIconUrl - set the icon url
 */
export const useIconUrl = (
  name: string,
  setSelectedBoss: React.Dispatch<React.SetStateAction<string>>,
  type: string,
  setIconUrl: React.Dispatch<React.SetStateAction<string>>,
) => {
  setSelectedBoss(name);

  if (type === 'A') {
    if (name === 'Wintertodt') {
      setIconUrl(
        `https://oldschool.runescape.wiki/images/thumb/Howling_Snow_Storm.gif/128px-Howling_Snow_Storm.gif`,
      );
    } else {
      const icon = iconMap.find((item) => item.name === name);

      if (icon) {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/${icon.replaceMentName}.png/128px-${icon.replaceMentName}.png`,
        );
      } else {
        const formattedName = name.replace(/\s+/g, '_').replace(/'/g, '%27');
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/${formattedName}.png/128px-${formattedName}.png`,
        );
      }
    }
  }
};
