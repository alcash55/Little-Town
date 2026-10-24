const profiles = {
  'little-town': {
    name: 'Little Town',
    showGangIcons: true,
    analytics: true,
    discordInviteUrl: 'https://discord.com/invite/NqzwU3TyUT',
  },
  'diamond-dogs': {
    name: 'The Diamond Dogs',
    showGangIcons: false,
    analytics: false,
    discordInviteUrl: null,
  },
};

export function resolveClanProfile(id: string | undefined) {
  if (id === undefined || id === '' || id === 'little-town') return profiles['little-town'];
  if (id === 'diamond-dogs') return profiles['diamond-dogs'];
  throw new Error('VITE_CLAN_ID must be little-town or diamond-dogs');
}
