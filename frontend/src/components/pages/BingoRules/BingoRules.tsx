import { Box, Button, Typography } from '@mui/material';
import { darkTheme } from '../../../layout/Theme';

const BingoRules = () => {
  const handleClick = async () => {
    console.log('clicked');
    await fetch('http://localhost:8080/hiscores?player=Lucky Buck2', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        const data = await response.text();
        console.log(data);
      })
      .catch((e) => console.log(e));
  };

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
      {/* <Button variant="outlined" onClick={handleClick} sx={{ color: 'white' }}>
        send request
      </Button> */}
    </Box>
  );
};

export default BingoRules;
