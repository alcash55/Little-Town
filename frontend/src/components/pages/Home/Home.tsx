import { Box, Typography, useTheme, useMediaQuery, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import cat from '../../../assets/Images/cat.svg';
import cum from '../../../assets/Images/cum.svg';
import fish from '../../../assets/Images/fish.svg';
import skull from '../../../assets/Images/skull.svg';
import ketchup from '../../../assets/Images/ketchup.svg';
import redHat from '../../../assets/Images/redHat.svg';
import foot from '../../../assets/Images/foot.svg';
import astral from '../../../assets/Images/astral.svg';
import blackHeart from '../../../assets/Images/blackHeart.svg';
import greenLootBeam from '../../../assets/Images/greenLootBeam.gif';
import heart from '../../../assets/Images/Imbued_heart_detail.png';
import { Countdown } from '../../countdown/Countdown';
import PenancePet from '../../../assets/Images/PenancePet.png';

interface LootbeamProps {
  image: string;
  name: string;
  item: string;
}

const Home = () => {
  const [breakpoint, setBreakpoint] = useState<string>('');
  const theme = useTheme();
  const sm = useMediaQuery(theme.breakpoints.down('sm'));
  const md = useMediaQuery(theme.breakpoints.down(800));
  const bingoDate = new Date('2024-01-05T23:59:59');
  const gangIcons = [cat, cum, fish, skull, ketchup, redHat, foot, astral, blackHeart];

  useEffect(() => {
    if (window.length <= 600) {
      setBreakpoint('sm');
    } else {
      setBreakpoint('');
    }
  }, [window.length, breakpoint]);

  const Lootbeam = ({ image, name, item }: LootbeamProps) => (
    <Box
      sx={{
        width: '40%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        pt: 5,
      }}
    >
      <img src={greenLootBeam} alt={'Loot Beam'} width="140px" height="auto" />
      <img
        src={image}
        alt="Little Town Logo"
        width="65"
        height="65"
        style={{
          borderRadius: '10px',
          marginTop: -80,
        }}
      />
      <Typography fontWeight={700} variant={'h6'} sx={{ ml: 2, mt: 1 }}>
        Not {name}'s {item}
      </Typography>
    </Box>
  );

  const Gangs = () => (
    <Box
      sx={{
        display: 'flex',
        width: sm ? '100%' : '65%',
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
  );

  const Header = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <Typography variant="h1" fontSize={48} pb={2}>
        Welcome to Little Town!
      </Typography>
      <Typography variant="body1" fontSize={sm ? 24 : 28}>
        In our Little Town, we strive to create a welcoming and inclusive community for all players.
        We celebrate our differences and encourage everyone to be themselves, as we understand that
        individuality is a key ingredient in building a vibrant community!
      </Typography>
      <Gangs />
    </Box>
  );

  return (
    <Box
      sx={{
        backgroundImage: 'linear-gradient(to bottom, #2A9D8F, #0d0d0d)',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        px: 5,
        alignItems: 'center',
      }}
    >
      {md ? <></> : <Lootbeam name={'Lili'} image={heart} item={'Heart'} />}

      <Stack height={'100%'} justifyContent={'space-evenly'}>
        <Header />
        <Countdown targetDate={bingoDate} />
      </Stack>

      {md ? <></> : <Lootbeam name={'Ken'} image={PenancePet} item={'BA pet'} />}
    </Box>
  );
};

export default Home;
