import { Stack, Button, Typography, Link, List, ListItem, ListItemText, Box } from '@mui/material';
import daRules from '../../../assets/Images/daRules.png';
import clanEventsSettings from '../../../assets/Images/clanEventsSettings.png';

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

  const backendTest = () => {
    const requests = [
      { handleClick, name: 'hiscores' },
      { handleClickSkills, name: 'skills' },
      { handleClickActivities, name: 'activities' },
    ];

    return (
      <>
        {requests.map((request, index) => (
          <Button
            key={index}
            variant="outlined"
            onClick={request.handleClick}
            sx={{ color: 'white' }}
          >
            {request.name.toUpperCase()}
          </Button>
        ))}
      </>
    );
  };

  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100vh'}
      justifyContent={'flex-start'}
      alignItems={'center'}
      spacing={2}
      sx={{ px: '2rem', pb: '2rem', overflowY: 'auto' }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          bgcolor: '#424242',
          pt: '1rem',
        }}
      >
        <img src={daRules} alt="bingo rules" width="15%" height="auto" />
      </Box>

      <Stack spacing={4}>
        <Stack spacing={2}>
          <Typography variant="h1" fontSize={48}>
            Objective
          </Typography>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
              <ListItemText
                primary={
                  'The aim is for your team to complete as much of the board as possible within the allotted time.'
                }
              />
            </ListItem>
          </List>
          <Typography variant="body1"></Typography>
        </Stack>
        <Stack spacing={2}>
          <Typography variant="h1" fontSize={48}>
            Setup
          </Typography>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
              <ListItemText
                primary={
                  <>
                    The event password will be shared at the start, use this password in the{' '}
                    <Link
                      href="https://runelite.net/plugin-hub/show/elysiumevents-plugin"
                      underline="hover"
                      target="_blank"
                      rel="noreferrer"
                      color="green"
                    >
                      Clan Events plugin in RuneLite
                    </Link>
                    . For example:{' '}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        pt: 2,
                      }}
                    >
                      <img
                        src={clanEventsSettings}
                        alt="clan events settings"
                        width="20%"
                        height="auto"
                      />
                    </Box>
                  </>
                }
              />
            </ListItem>
            <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
              <ListItemText primary={<>OSRS settings for drop amount</>} />
            </ListItem>
          </List>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h1" fontSize={48}>
            Screenshots
          </Typography>
          <Typography variant="body1">
            <List sx={{ listStyleType: 'disc', pl: 4 }}>
              <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                <ListItemText
                  primary={
                    <>
                      Stacking methods are not allowed, including but not limited to:
                      <List sx={{ listStyleType: 'circle', pl: 4 }}>
                        <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                          <ListItemText primary="Dark Essence Blocks" />
                        </ListItem>
                        <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                          <ListItemText primary="Blast Mine" />
                        </ListItem>
                        <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                          <ListItemText primary="Clue Caskets" />
                        </ListItem>
                        <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                          <ListItemText primary="Brimhaven Agility Arena tickets" />
                        </ListItem>
                      </List>
                    </>
                  }
                />
              </ListItem>
              <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                <ListItemText
                  primary={
                    <>
                      You must provide screenshots of your open bank, searching for the words
                      "block" and "agility." If you have any of these items in your bank, you must
                      end the event with the same quantity. Example:
                    </>
                  }
                />
              </ListItem>
              <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                <ListItemText
                  primary={
                    <>
                      Provide a screenshot of yourself at the Blast Mine to ensure no stacked ores
                      for large XP drops. Example:{' '}
                      <Link
                        href="https://imgur.com/7PiSDtp"
                        underline="hover"
                        target="_blank"
                        rel="noreferrer"
                        color="green"
                      >
                        https://imgur.com/7PiSDtp
                      </Link>
                    </>
                  }
                />
              </ListItem>
              <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                <ListItemText
                  primary={
                    ' You CANNOT stack KC or XP for a Boss or Skill before the event begins. Thismeans no accumulating XP or KC for a 6-hour log and then logging out after thebingo starts.'
                  }
                />
              </ListItem>
              <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
                <ListItemText primary=" Please log out before the event starts to ensure fairness. If you don't, your XP and KC will be manually removed." />
              </ListItem>
            </List>
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="h1" fontSize={48}>
            Tie Breakers
          </Typography>
          <List sx={{ listStyleType: 'disc', pl: 4 }}>
            <ListItem sx={{ p: 0, m: 0, display: 'list-item' }}>
              <ListItemText
                primary="In the result of a tie on collection log points, a second tie-breaker will be based on
                quantity of Collection Log categories completed."
              />
            </ListItem>
          </List>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default BingoRules;
