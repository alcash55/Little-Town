import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { appColors } from '../../../layout/Theme';

interface Props {
  onNavigateAway: () => void;
}

const ResourcesStep = ({ onNavigateAway }: Props) => {
  const navigate = useNavigate();

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
      <DriveFileMoveIcon sx={{ fontSize: 40, color: appColors.accent }} />
      <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
        Tips &amp; strategies
      </Typography>
      <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 380 }}>
        The Resources page has tips, strats, RuneLite marker configs, and screenshots for the
        bosses and skills on the board — worth a look before you start grinding tiles.
      </Typography>
      <Button
        variant="contained"
        onClick={() => {
          onNavigateAway();
          navigate('/Resources');
        }}
        sx={{ bgcolor: appColors.accent, color: appColors.textPrimary, '&:hover': { bgcolor: appColors.accent, opacity: 0.85 } }}
      >
        Open Resources
      </Button>
    </Stack>
  );
};

export default ResourcesStep;
