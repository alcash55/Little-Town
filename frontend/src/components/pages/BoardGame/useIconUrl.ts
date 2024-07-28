const iconMap = [
  { name: 'Barrows', icon: 'Dharok_the_Wretched.png' },
  { name: 'Grotesque Guardians', icon: 'Dusk.png' },
  { name: 'Chambers of Xeric', icon: 'Great_Olm.png' },
  { name: 'Theatre of Blood', icon: 'Verzik_Vitur.png' },
  { name: 'Tombs of Amascut', icon: 'Tumeken%27s_Warden_%28level-489%29.png' },
  { name: 'Alchemical Hydra', icon: 'Alchemical_Hydra_%28serpentine%29.png' },
  { name: 'Dagannoth Kings', icon: 'Dagannoth_Supreme.png' },
  { name: 'Phantom Mustpah', icon: 'Phantom_Muspah_%28ranged%29.png' },
  { name: 'Wintertodt', icon: 'Howling_Snow_Storm.gif' },
  { name: 'Zulrah', icon: 'Zulrah_%28serpentine%29.png' },
];

export const useIconUrl = (
  name: string,
  setSelectedBoss: React.Dispatch<React.SetStateAction<string>>,
  type: string,
  setIconUrl: React.Dispatch<React.SetStateAction<string>>,
) => {
  setSelectedBoss(name);

  if (type === 'A') {
    const formattedName = name.replace(/\s+/g, '_').replace(/'/g, '%27');
    for (let i = 0; i < iconMap.length; i++) {
      if (iconMap[i].name === name) {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/${iconMap[i].icon}/128px-${iconMap[i].icon}`,
        );
      } else {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/${formattedName}.png/128px-${formattedName}.png`,
        );
      }
    }
  }
};
