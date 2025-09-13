import { Stack, Typography } from '@mui/material';
import { darkTheme } from '../../../../layout/Theme';
import { useTeamDrafter } from './useTeamDrafter';

/**
 * @see https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/?path=/docs/presets-sortable-multiple-containers--basic-setup
 */
const TeamDrafter = () => {
  //   const {} = useTeamDrafter();
  return (
    <Stack
      spacing={3}
      height={'100%'}
      width={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Team Drafter
      </Typography>
    </Stack>
  );
};

export default TeamDrafter;
