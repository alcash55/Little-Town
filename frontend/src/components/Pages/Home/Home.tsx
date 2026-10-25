import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { clan } from '../../../config/clan';
import { ClanIdentity } from '../../ClanIdentity/ClanIdentity';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { gangIcons } from './gangIcons';

export function Home() {
  const { user, openLogin } = useLoginModal();
  const features = [
    {
      number: '01 / Team up',
      title: 'Find your party.',
      text: "Join your assigned team and see everyone's contribution in one place.",
      label: 'Meet your team',
      to: '/TeamData',
    },
    {
      number: '02 / Chase a tile',
      title: 'Choose the next run.',
      text: "Check task requirements and keep the clan's boss guides close.",
      label: 'Browse resources',
      to: '/Resources',
    },
    {
      number: '03 / Bring the proof',
      title: 'Make the drop count.',
      text: 'Submit your screenshot in Discord. Approved drops move your team up the standings.',
      label: 'Follow the competition',
      to: '/BingoScores',
    },
  ];
  return (
    <PageLayout maxWidth="full">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
          gap: { xs: 4, md: 7 },
          alignItems: 'center',
          py: { xs: 2, md: 5 },
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
            Old School RuneScape · {clan.name} clan
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 44, sm: 54, lg: 64 },
              lineHeight: 1.07,
              letterSpacing: -1,
              mt: 2,
              mb: 3,
            }}
          >
            Good company.
            <br />
            Great drops.
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 440, mb: 3.5 }}>
            A home for the clan, from the first boss trip to the final bingo tile. Team up, find
            your next challenge, and make every drop count.
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
            <Button component={Link} to="/BingoBoard" variant="contained">
              Explore the bingo board →
            </Button>
            {!user && <Button onClick={openLogin}>Clan member? Log in</Button>}
          </Stack>
          {clan.showGangIcons && (
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', mt: 4, alignItems: 'center' }}
            >
              {gangIcons.slice(0, 5).map((icon) => (
                <Box
                  component="img"
                  key={icon.name}
                  src={icon.src}
                  alt={`${clan.name} ${icon.label} logo`}
                  sx={{ width: 20, height: 22, objectFit: 'contain' }}
                />
              ))}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Your people. Your next adventure.
              </Typography>
            </Stack>
          )}
        </Box>
        <Box>
          <ClanIdentity hero />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Our corner of Gielinor.
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          borderLeft: 3,
          borderColor: 'primary.main',
          bgcolor: 'background.paper',
          p: { xs: 3, md: 4 },
          my: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            The clan competition
          </Typography>
          <Typography variant="h2" sx={{ my: 1 }}>
            Pick your next hunt.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Explore the tasks as a guest, or log in to follow your team's progress.
          </Typography>
        </Box>
        <Button component={Link} to="/BingoBoard" variant="outlined">
          View competition →
        </Button>
      </Box>
      <Box sx={{ py: 3 }}>
        <Typography variant="overline" color="text.secondary">
          A clan competition, together
        </Typography>
        <Typography variant="h2" sx={{ mt: 1, mb: 3 }}>
          More reasons to log in.
        </Typography>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 4 }}
        >
          {features.map((f) => (
            <Box key={f.to} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography variant="caption" color="primary">
                {f.number}
              </Typography>
              <Typography variant="h3" sx={{ mt: 1.5, mb: 1 }}>
                {f.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, minHeight: { md: 70 } }}
              >
                {f.text}
              </Typography>
              <Button
                component={user || f.to === '/Resources' ? Link : 'button'}
                to={user || f.to === '/Resources' ? f.to : undefined}
                onClick={!user && f.to !== '/Resources' ? openLogin : undefined}
                sx={{ px: 0 }}
              >
                {f.label} →
              </Button>
            </Box>
          ))}
        </Box>
      </Box>
      <Divider />
      <Stack
        direction="row"
        useFlexGap
        sx={{ pt: 2, justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Typography variant="caption" color="text.secondary">
          {clan.name} · Old School RuneScape community
        </Typography>
        {clan.discordInviteUrl && (
          <Button
            component="a"
            href={clan.discordInviteUrl}
            target="_blank"
            rel="noreferrer"
            size="small"
          >
            Clan Discord ↗
          </Button>
        )}
      </Stack>
    </PageLayout>
  );
}
export default Home;
