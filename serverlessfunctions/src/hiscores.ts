// https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
export const hiscores = async (rsn) => {
  const bosses = [
    "abyssal_sire",
    "alchemical_hydra",
    "barrows_chests",
    "bryophyta",
    "callisto",
    "cerberus",
    "chambers_of_xeric",
    "chambers_of_xeric_challenge_mode",
    "chaos_elemental",
    "chaos_fanatic",
    "commander_zilyana",
    "corporeal_beast",
    "crazy_archaeologist",
    "dagannoth_prime",
    "dagannoth_rex",
    "dagannoth_supreme",
    "deranged_archaeologist",
    "general_graardor",
    "giant_mole",
    "grotesque_guardians",
    "hespori",
    "kalphite_queen",
    "king_black_dragon",
    "kraken",
    "kreearra",
    "kril_tsutsaroth",
    "mimic",
    "nightmare",
    "obor",
    "sarachnis",
    "scorpia",
    "skotizo",
    "the_gauntlet",
    "the_corrupted_gauntlet",
    "theatre_of_blood",
    "thermonuclear_smoke_devil",
    "tzkal_zuk",
    "tztok_jad",
    "venenatis",
    "vetion",
    "vorkath",
    "wintertodt",
    "zalcano",
    "zulrah",
  ];

  const skills = [
    "overall",
    "attack",
    "defence",
    "strength",
    "constitution",
    "ranged",
    "prayer",
    "magic",
    "cooking",
    "woodcutting",
    "fletching",
    "fishing",
    "firemaking",
    "crafting",
    "smithing",
    "mining",
    "herblore",
    "agility",
    "thieving",
    "slayer",
    "farming",
    "runecrafting",
    "hunter",
    "construction",
  ];

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
