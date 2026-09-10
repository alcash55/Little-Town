import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  Stack,
  Button,
  IconButton,
  Slide,
} from '@mui/material';
import BarChart from '@mui/icons-material/BarChart';
import EmojiEvents from '@mui/icons-material/EmojiEvents';
import Gavel from '@mui/icons-material/Gavel';
import BoardGame from '../../../assets/Images/BoardGame';
import { Link } from 'react-router-dom';
import cat from '../../../assets/Images/cat.svg';
import cum from '../../../assets/Images/cum.svg';
import fish from '../../../assets/Images/fish.svg';
import skull from '../../../assets/Images/skull.svg';
import ketchup from '../../../assets/Images/ketchup.svg';
import redHat from '../../../assets/Images/redHat.svg';
import foot from '../../../assets/Images/foot.svg';
import astral from '../../../assets/Images/astral.svg';
import blackHeart from '../../../assets/Images/blackHeart.svg';
import { useLoginModal } from '../../LoginModal/useLoginModal';

type Role = 'user' | 'admin' | 'moderator';

const playerButtons = [
  {
    label: 'Bingo Rules',
    to: '/BingoRules',
    icon: <Gavel />,
    roles: ['user', 'admin', 'moderator'] as Role[],
  },
  {
    label: 'Bingo Board',
    to: '/BingoBoard',
    icon: <BoardGame />,
    roles: ['user', 'admin', 'moderator'] as Role[],
  },
  {
    label: 'Team Data',
    to: '/TeamData',
    icon: <BarChart />,
    roles: ['user', 'admin', 'moderator'] as Role[],
  },
  {
    label: 'Bingo Scores',
    to: '/BingoScores',
    icon: <EmojiEvents />,
    roles: ['user', 'admin', 'moderator'] as Role[],
  },
];

// Explicit, reviewed accessible name per icon, not derived from the asset
// filename. A sliced filename was previously announced verbatim to screen
// reader users, including one that read "Little Town cum logo" (see #59).
const gangIcons = [
  { src: cat, label: 'cat' },
  { src: cum, label: 'relish' },
  { src: fish, label: 'fish' },
  { src: skull, label: 'skull' },
  { src: ketchup, label: 'ketchup' },
  { src: redHat, label: 'red hat' },
  { src: foot, label: 'foot' },
  { src: astral, label: 'astral' },
  { src: blackHeart, label: 'black heart' },
];

const Home = () => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down(630));
  const { user } = useLoginModal();

  /**
   * Only show pages the user has permissions to see
   */
  const visibleButtons = import.meta.env.DEV
    ? playerButtons
    : playerButtons.filter((btn) => user?.role && btn.roles.includes(user.role));

  /**
   * @see https://oldschool.runescape.wiki/w/Category:Clan_rank_icons?filefrom=Clan+icon+-+Runecrafter.png#mw-category-media
   */
  const Gangs = (
    <Slide direction="left" in={true} timeout={1000}>
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          p: 1,
        }}
      >
        {gangIcons.map(({ src, label }) => (
          <img
            aria-label={`Little Town ${label} logo`}
            key={label}
            width="25"
            height="auto"
            src={src}
          />
        ))}
      </Box>
    </Slide>
  );

  const NavButtons = (
    <>
      {isTablet ? (
        <>
          {visibleButtons.map((btn) => (
            <IconButton key={btn.to} component={Link} to={btn.to}>
              {btn.icon}
            </IconButton>
          ))}
        </>
      ) : (
        <>
          {visibleButtons.map((btn) => (
            <Button key={btn.to} variant="contained" to={btn.to} component={Link}>
              {btn.label}
            </Button>
          ))}
        </>
      )}
    </>
  );

  return (
    <Box
      sx={{
        backgroundImage: 'linear-gradient(to bottom, #2A9D8F, #0d0d0d)',
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        px: 2,
        alignItems: 'center',
        textAlign: 'center',
        xOverflow: 'hidden',
      }}
    >
      <Stack
        spacing={3}
        sx={{
          height: '100%',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: 48,
          }}
        >
          Welcome to Little Town!
        </Typography>

        {Gangs}

        <Stack
          direction={'row'}
          spacing={2}
          sx={{
            justifyContent: 'space-evenly',
          }}
        >
          {NavButtons}
        </Stack>
      </Stack>
    </Box>
  );
};

export default Home;
