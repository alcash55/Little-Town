import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  Stack,
  Button,
  IconButton,
  Slide,
  keyframes,
} from '@mui/material';
import { BarChart, EmojiEvents, Gavel } from '@mui/icons-material';
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

const Home = () => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down(630));
  const gangIcons = [cat, cum, fish, skull, ketchup, redHat, foot, astral, blackHeart];

  /**
   * @see https://codepen.io/ss/pen/wGXOxa
   */
  const headerAnimation = {
    transition: 'transform 0.5s ease, color 0.3s ease',
    '&:hover': {
      '@keyframes wave': {
        '0%': { top: '0px;' },
        '50%': { top: '-15px;' },
        '100%': { top: '0px' },
      },

      animation: 'wave 1.0s ease infinite',
    },
  };

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
        {gangIcons.map((name, index) => (
          <img
            aria-label={'Little Town Gang Logos'}
            key={index}
            width="25"
            height="auto"
            src={name}
          />
        ))}
      </Box>
    </Slide>
  );

  const NavButtons = (
    <>
      {isTablet ? (
        <>
          <IconButton component={Link} to="BingoRules">
            <Gavel />
          </IconButton>
          <IconButton component={Link} to="BingoBoard">
            <BoardGame />
          </IconButton>
          <IconButton component={Link} to="TeamData">
            <BarChart />
          </IconButton>
          <IconButton component={Link} to="BingoScores">
            <EmojiEvents />
          </IconButton>
        </>
      ) : (
        <>
          <Button variant="contained" to="/BingoRules" component={Link}>
            Bingo Rules
          </Button>
          <Button variant="contained" to="/BingoBoard" component={Link}>
            Bingo Board
          </Button>
          <Button variant="contained" to="/TeamData" component={Link}>
            Team Data
          </Button>
          <Button variant="contained" to="/BingoScores" component={Link}>
            Bingo Scores
          </Button>
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
      <Stack height={'100%'} justifyContent={'center'} spacing={3}>
        <Typography variant="h1" fontSize={48} sx={headerAnimation}>
          Welcome to Little Town!
        </Typography>

        {Gangs}

        <Stack justifyContent={'space-evenly'} direction={'row'} spacing={2}>
          {NavButtons}
        </Stack>
      </Stack>
    </Box>
  );
};

export default Home;
