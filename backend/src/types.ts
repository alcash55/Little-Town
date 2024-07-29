export type player = {
  rsn: string;
  skill_xp: skill[];
  boss_kc: bosses[];
};

type skill = {
  rank: number;
  level: number;
  experience: number;
};

type bosses = {
  rank: number;
  kill_count: number;
};
