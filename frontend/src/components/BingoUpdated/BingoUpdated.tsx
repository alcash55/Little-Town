import { CheckCircleOutlined as CheckCircleOutline } from '@mui/icons-material';
import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { darkTheme } from '../../layout/Theme';

interface BingoUpdatedProps {
  /** Was it a POST or a PUT */
  isUpdated: boolean;
  itemUpdated: string;
  /** Resets the parent's submitted state to show the form again */
  onMakeChanges: () => void;
  /** Route for the next step in the bingo setup flow */
  nextStepPath: string;
  /** Label for the next step button e.g. 'Build Board' */
  nextStepLabel: string;
}

export const BingoUpdated = ({
  isUpdated,
  itemUpdated,
  onMakeChanges,
  nextStepPath,
  nextStepLabel,
}: BingoUpdatedProps) => {
  const navigate = useNavigate();

  return (
    <Stack
      spacing={3}
      sx={{
        alignItems: 'center',
        flex: 1,
      }}
    >
      <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main' }} />
      <Typography variant="h2" sx={{ fontSize: 28, textAlign: 'center', color: 'success.main' }}>
        {isUpdated ? `${itemUpdated} Updated!` : `${itemUpdated} Created!`}
      </Typography>
      <Typography
        variant="body1"
        sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}
      >
        {isUpdated
          ? `${itemUpdated} has been updated successfully.`
          : `${itemUpdated} has been created successfully.`}
      </Typography>
      <Stack spacing={2} direction="row">
        <Button variant="outlined" color="success" onClick={onMakeChanges}>
          Make Changes
        </Button>
        <Button variant="contained" color="success" onClick={() => navigate(nextStepPath)}>
          {nextStepLabel}
        </Button>
      </Stack>
    </Stack>
  );
};
