import { Box } from '@mui/material';
import bingoBoard from '../../../assets/Images/BingoBoardExample.png';
import PageLayout from '../../../layout/PageLayout/PageLayout';

/**
 * @see https://github.com/alcash55/Little-Town/blob/bb62a287a241cdf1f5dcbfee77b2526c296a36a9/frontend/src/components/pages/BoardGame/BoardGame.tsx
 */
const BingoBoard = () => {
  return (
    <PageLayout title="Bingo Board" maxWidth="full">
      <Box
        component="img"
        src={bingoBoard}
        alt="bingo board"
        sx={{ width: '100%', maxWidth: 900, height: 'auto' }}
      />
    </PageLayout>
  );
};

export default BingoBoard;
