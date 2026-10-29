import { useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import daRules from '../../../assets/Images/daRules.png';
import blastMine from '../../../assets/Images/blastfurnace.png';
import clanEvents from '../../../assets/Images/clanEventsSettings.png';
import untradeableLoot from '../../../assets/Images/untradeableLootNotifications.png';
import lootDrops from '../../../assets/Images/lootDropNotifications.png';
import bankBlock from '../../../assets/Images/screenshotsBlock.png';
import bankAgility from '../../../assets/Images/screenshotsAgility.png';
import PageLayout from '../../../layout/PageLayout/PageLayout';

const sections = [
  ['objective', 'Objective'],
  ['setup', 'RuneLite setup'],
  ['screenshots', 'Screenshots & fairness'],
  ['ties', 'Tie breakers'],
];
export function BingoRules() {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const screenshot = (src: string, alt: string) => (
    <Box
      component="figure"
      sx={{
        m: 0,
        my: 3,
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <ButtonBase
        onClick={() => setImage({ src, alt })}
        aria-label={`Enlarge ${alt}`}
        sx={{ display: 'block', maxWidth: '100%', textAlign: 'left', cursor: 'zoom-in' }}
      >
        <Box
          component="img"
          src={src}
          alt={alt}
          sx={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      </ButtonBase>
      <Typography
        component="figcaption"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1.5 }}
      >
        {alt} · Click to enlarge
      </Typography>
    </Box>
  );
  return (
    <PageLayout maxWidth={1100}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Competition handbook
          </Typography>
          <Typography variant="h1" sx={{ my: 1 }}>
            Ready before the first drop.
          </Typography>
          <Typography color="text.secondary">
            The clan rules and setup screenshots, kept together.
          </Typography>
        </Box>
        <Box
          component="img"
          src={daRules}
          alt="Original bingo rules artwork"
          sx={{ width: { xs: 60, sm: 90 }, height: 'auto' }}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '190px minmax(0, 1fr)' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <Box
          component="nav"
          aria-label="Rule sections"
          sx={{
            position: { md: 'sticky' },
            top: 24,
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            overflowX: 'auto',
            gap: 1,
          }}
        >
          {sections.map(([id, label], i) => (
            <Link
              href={`#rule-${id}`}
              key={id}
              underline="hover"
              sx={{ py: 1, color: 'text.secondary', whiteSpace: 'nowrap', fontSize: 12 }}
            >
              {String(i + 1).padStart(2, '0')} / {label}
            </Link>
          ))}
        </Box>
        <Box
          component="article"
          sx={{
            maxWidth: 850,
            minWidth: 0,
            '& section': {
              mb: 5,
              pb: 4,
              borderBottom: 1,
              borderColor: 'divider',
              scrollMarginTop: 24,
            },
            '& h2': { mb: 2 },
            '& ul': { color: 'text.secondary', lineHeight: 1.9 },
            '& p': { color: 'text.secondary', mb: 2 },
          }}
        >
          <section id="rule-objective">
            <Typography variant="h2">Complete the board together.</Typography>
            <Typography>
              The aim is for your team to complete as much of the board as possible within the
              allotted time.
            </Typography>
          </section>
          <section id="rule-setup">
            <Typography variant="h2">Set up RuneLite before the event.</Typography>
            <Typography>
              The event password will be shared at the start. Use this password in the{' '}
              <Link
                href="https://runelite.net/plugin-hub/show/elysiumevents-plugin"
                target="_blank"
                rel="noreferrer"
              >
                Clan Events plugin in RuneLite
              </Link>
              .
            </Typography>
            {screenshot(clanEvents, 'Clan Events plugin settings')}
            <Typography>
              Make sure these settings are checked to ensure drops show up in the chat for
              screenshots.
            </Typography>
            {screenshot(untradeableLoot, 'Untradeable loot notifications setting')}
            {screenshot(lootDrops, 'Loot drop notifications setting')}
          </section>
          <section id="rule-screenshots">
            <Typography variant="h2">Start with a clean slate.</Typography>
            <Typography>Stacking methods are not allowed, including but not limited to:</Typography>
            <ul>
              {[
                'Dark Essence Blocks',
                'Blast Mine',
                'Clue Caskets',
                'Brimhaven Agility Arena tickets',
                'Lockboxes',
                'Keys',
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Typography>
              You must provide screenshots of your open bank, searching for the words "block" and
              "agility". If you have any of these items in your bank, you must end the event with
              the same quantity.
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              {screenshot(bankBlock, 'Open bank searched for block')}
              {screenshot(bankAgility, 'Open bank searched for agility')}
            </Box>
            <Typography>
              Provide a screenshot of yourself at the Blast Mine to ensure no stacked ores for large
              XP drops.
            </Typography>
            {screenshot(blastMine, 'Blast Mine screenshot example')}
            <Link href="https://imgur.com/7PiSDtp" target="_blank" rel="noreferrer">
              Open the original Blast Mine example ↗
            </Link>
            <Typography sx={{ mt: 3 }}>
              You cannot stack KC or XP for a boss or skill before the event begins. This means no
              accumulating XP or KC for a 6-hour log and then logging out after the bingo starts.
            </Typography>
            <Typography>
              Please log out before the event starts to ensure fairness. If you don't, your XP and
              KC will be manually removed.
            </Typography>
          </section>
          <section id="rule-ties">
            <Typography variant="h2">Know how a tie is settled.</Typography>
            <Typography>
              In the event of a tie, the admins will use the predetermined tie breaker communicated
              at the start of the bingo.
            </Typography>
          </section>
        </Box>
      </Box>
      <Dialog open={image !== null} onClose={() => setImage(null)} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          {image?.alt}
          <Button onClick={() => setImage(null)} aria-label="Close screenshot">
            Close
          </Button>
        </DialogTitle>
        <DialogContent>
          {image && (
            <Box
              component="img"
              src={image.src}
              alt={image.alt}
              sx={{ display: 'block', maxWidth: '100%', height: 'auto', mx: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
export default BingoRules;
