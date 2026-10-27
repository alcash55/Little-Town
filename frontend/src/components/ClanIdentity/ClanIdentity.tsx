import { lazy, Suspense } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { clan } from '../../config/clan';
import { appColors } from '../../layout/Theme';
import bandos from '../../assets/Images/bosses/bandos-chestplate.png';
import ancestral from '../../assets/Images/bosses/ancestral-hat.png';
import cerberus from '../../assets/Images/bosses/cerberus.png';
const LittleTownLogo = lazy(() =>
  import('./LittleTownLogo').then((m) => ({ default: m.LittleTownLogo })),
);
export function ClanIdentity({ hero = false }: { hero?: boolean }) {
  const name = (
    <Typography
      component="span"
      variant={hero ? 'h2' : 'h6'}
      sx={{
        display: 'block',
        overflowWrap: 'anywhere',
        fontSize: hero ? { xs: 32, md: 42 } : { xs: 16, sm: 20 },
      }}
    >
      {clan.name}
    </Typography>
  );
  if (clan.loadingAnimation === 'little-town') {
    return (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Suspense fallback={name}>
          <LittleTownLogo hero={hero} />
        </Suspense>
        {!hero && <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{name}</Box>}
      </Stack>
    );
  }
  if (!hero) return name;
  return (
    <Box
      sx={{ p: { xs: 3, md: 5 }, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Typography variant="overline" color="text.secondary">
        Old School RuneScape · Clan bingo
      </Typography>
      {name}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Team up. Chase the next tile. Bring the proof.
      </Typography>
      <Stack direction="row" spacing={3} sx={{ mt: 3 }}>
        {[bandos, ancestral, cerberus].map((src) => (
          <Box
            key={src}
            component="img"
            src={src}
            alt="OSRS task artwork"
            sx={{
              width: 44,
              height: 52,
              objectFit: 'contain',
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 3px 3px ${appColors.background})`,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
