import type { Plugin } from 'vite';
import { resolveClanProfile } from '../config/clanProfiles';

export function clanBrandingPlugin(): Plugin {
  let profile = resolveClanProfile(undefined);
  return {
    name: 'clan-branding',
    configResolved(config) {
      profile = resolveClanProfile(config.env.VITE_CLAN_ID);
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const branded = html.replace(
          '<title>Little Town</title>',
          `<title>${profile.name}</title>`,
        );
        return profile.showGangIcons
          ? branded
          : branded.replace('./src/assets/Images/Little_Town.ico', '/bingo.svg');
      },
    },
  };
}
