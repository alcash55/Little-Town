import { resolveClanProfile } from './clanProfiles';

export const clan = resolveClanProfile(import.meta.env.VITE_CLAN_ID);
