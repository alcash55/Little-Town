import { Box, Typography } from '@mui/material';
import bingoBoard from '../../../assets/Images/BingoBoardExample.png';
import { darkTheme } from '../../../layout/Theme';

const BingoBoard = () => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        bgcolor: darkTheme.palette.primary.main,
      }}
    >
      <Typography p={3} variant="h1" fontSize={48} textAlign={'center'}>
        Bingo Board
      </Typography>
      <img src={bingoBoard} width={900} height={'auto'} />
    </Box>
  );
};

export default BingoBoard;
