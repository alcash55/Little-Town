import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { BingoBoardInfo, BingoBoardTeam } from './useBingoBoard';

export interface BingoBoardHeaderProps {
  bingo: BingoBoardInfo;
  myTeam: BingoBoardTeam | null;
  completedCount: number;
  totalCount: number;
}

export const BingoBoardHeader = ({
  bingo,
  myTeam,
  completedCount,
  totalCount,
}: BingoBoardHeaderProps) => {
  const { user, openLogin, prefetchLoginModal } = useLoginModal();
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        borderBottom: 1,
        borderColor: 'divider',
        pb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: 10, lineHeight: 1.5 }}
        >
          Bingo board
        </Typography>
        <Typography
          component="h1"
          variant="h2"
          sx={{ fontSize: { xs: 22, sm: 26 }, overflowWrap: 'anywhere' }}
        >
          {bingo.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {myTeam
            ? `${myTeam.name} · Checked tiles are completed by your team.`
            : user
            ? 'No team assigned yet. Explore the board while you wait for the draft.'
            : "Viewing as a guest. Log in to highlight your team's progress."}
        </Typography>
      </Box>
      {myTeam ? (
        <Stack spacing={0.75} sx={{ width: { xs: '100%', sm: 200 }, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Your progress · {completedCount} / {totalCount}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={pct}
            aria-label={`${myTeam.name} has completed ${completedCount} of ${totalCount} tiles`}
            sx={{ height: 6, borderRadius: 1 }}
          />
        </Stack>
      ) : (
        !user && (
          <Button
            size="small"
            startIcon={<LoginIcon fontSize="small" />}
            onClick={openLogin}
            onMouseEnter={prefetchLoginModal}
          >
            Log in
          </Button>
        )
      )}
    </Box>
  );
};
