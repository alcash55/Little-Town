import { alpha } from '@mui/material/styles';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { appColors } from '../../../../layout/Theme';
import { useScreenshotSubmission } from './useScreenshotSubmission';
import { ScreenshotCard } from './ScreenshotCard';

const ScreenshotSubmission = () => {
  const {
    pending,
    teams,
    players,
    tileOptions,
    boardMissingTileIds,
    loading,
    refreshing,
    error,
    refresh,
    teamsBoardError,
    dismissTeamsBoardError,
    tileSelection,
    teamSelection,
    playerSelection,
    setTileForSubmission,
    setTeamForSubmission,
    setPlayerForSubmission,
    reviewing,
    reviewError,
    dismissReviewError,
    approve,
    deny,
  } = useScreenshotSubmission();

  if (loading) {
    return (
      <PageLayout title="Screenshot Submissions" align="center">
        <CircularProgress sx={{ color: appColors.accent }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Screenshot Submissions" align="center">
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={refresh}
          sx={{ color: appColors.accent, borderColor: appColors.accent }}
        >
          Retry
        </Button>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Screenshot Submissions" maxWidth="full">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <Typography variant="body2" sx={{ color: textSecondary }}>
          {pending.length === 0
            ? ' '
            : `${pending.length} screenshot${
                pending.length > 1 ? 's' : ''
              } pending review — assign a tile and team, then approve or deny.`}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={refreshing}
          startIcon={
            refreshing ? (
              <CircularProgress size={16} sx={{ color: appColors.accent }} />
            ) : (
              <SyncIcon />
            )
          }
          onClick={refresh}
          sx={{
            color: appColors.accent,
            borderColor: appColors.accent,
            '&:hover': { borderColor: appColors.accent, bgcolor: alpha(appColors.accent, 0.08) },
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Box>

      {teamsBoardError && (
        <Alert severity="warning" sx={{ width: '100%' }} onClose={dismissTeamsBoardError}>
          {teamsBoardError}
        </Alert>
      )}

      {pending.length === 0 ? (
        <Stack
          spacing={1.5}
          sx={{
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
            py: 8,
            color: textSecondary,
          }}
        >
          <TaskAltIcon sx={{ fontSize: 56, color: appColors.accent }} />
          <Typography variant="h3" sx={{ fontSize: 20, color: appColors.textPrimary }}>
            All caught up
          </Typography>
          <Typography variant="body2" sx={{ color: textSecondary, maxWidth: 360 }}>
            No screenshots are waiting for review right now. New submissions from Discord will show
            up here automatically — this page polls every 45 seconds.
          </Typography>
        </Stack>
      ) : (
        <Box
          aria-busy={refreshing}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            width: '100%',
          }}
        >
          {pending.map((submission) => (
            <ScreenshotCard
              key={submission.id}
              submission={submission}
              tileOptions={tileOptions}
              teams={teams}
              players={players}
              boardMissingTileIds={boardMissingTileIds}
              tileId={tileSelection[submission.id]}
              teamId={teamSelection[submission.id]}
              playerId={playerSelection[submission.id]}
              onTileChange={(tileId) => setTileForSubmission(submission.id, tileId)}
              onTeamChange={(teamId) => setTeamForSubmission(submission.id, teamId)}
              onPlayerChange={(playerId) => setPlayerForSubmission(submission.id, playerId)}
              onApprove={() => approve(submission.id)}
              onDeny={() => deny(submission.id)}
              isApproving={reviewing?.id === submission.id && reviewing.action === 'approve'}
              isDenying={reviewing?.id === submission.id && reviewing.action === 'deny'}
              error={reviewError[submission.id]}
              onDismissError={() => dismissReviewError(submission.id)}
            />
          ))}
        </Box>
      )}
    </PageLayout>
  );
};

export default ScreenshotSubmission;
