import { Stack, Typography } from '@mui/material';
import bingoBoard from '../../../assets/Images/BingoBoardExample.png';

const BingoBoard = () => {
  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Typography p={3} variant="h1" fontSize={48} textAlign={'center'}>
        Bingo Board
      </Typography>
      <img src={bingoBoard} width={900} height={'auto'} alt="test bingo board" />
    </Stack>
  );
};

export default BingoBoard;
