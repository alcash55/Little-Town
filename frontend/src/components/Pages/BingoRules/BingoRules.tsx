import { Stack, Button, Typography } from '@mui/material';

const BingoRules = () => {
  const handleClick = async () => {
    console.log('clicked');
    await fetch('http://localhost:8081/hiscores?player=Lucky Buck2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        const data = await response.text();
        console.log(data);
      })
      .catch((e) => console.log(e));
  };

  const handleClickSkills = async () => {
    console.log('clicked');
    try {
      const response = await fetch('http://localhost:8081/api/skills', {
        method: 'GET',
        // headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text(); // Or use response.json() if you expect JSON
      console.log(data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const handleClickActivities = async () => {
    console.log('clicked');
    try {
      const response = await fetch('http://localhost:8081/api/hiscores/activities/list', {
        method: 'GET',
        // headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text(); // Or use response.json() if you expect JSON
      console.log(data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Typography variant="h1">Da Rules</Typography>
      <Button variant="outlined" onClick={handleClick} sx={{ color: 'white' }}>
        send skills data request
      </Button>

      <Button variant="outlined" onClick={handleClickSkills} sx={{ color: 'white' }}>
        send request for list of skills
      </Button>

      <Button variant="outlined" onClick={handleClickActivities} sx={{ color: 'white' }}>
        send request for list of activities
      </Button>
    </Stack>
  );
};

export default BingoRules;
