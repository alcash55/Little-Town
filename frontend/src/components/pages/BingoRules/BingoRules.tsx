import { Box, Typography } from '@mui/material';
import { darkTheme } from '../../../layout/Theme';

const BingoRules = () => {
  return (
    <Box
      sx={{
        bgcolor: darkTheme.palette.primary.main,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography variant="h1">Da Rules</Typography>
    </Box>
  );
};

export default BingoRules;
