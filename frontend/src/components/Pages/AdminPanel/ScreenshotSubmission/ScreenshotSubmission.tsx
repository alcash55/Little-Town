import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
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
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Screenshot Submissions" align="center">
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>{error}</Alert>
        <Button variant="outlined" onClick={refresh} sx={{ color: '#2A9D8F', borderColor: '#2A9D8F' }}>
          Retry
        </Button>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Screenshot Submissions" maxWidth="full">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Typography variant="body2" sx={{ color: textSecondary }}>
          {pending.length === 0
            ? 'No screenshots pending review.'
            : `${pending.length} screenshot${pending.length > 1 ? 's' : ''} pending review — assign a tile and team, then approve or deny.`}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={refreshing}
          startIcon={
            refreshing ? (
              <CircularProgress size={16} sx={{ color: '#2A9D8F' }} />
            ) : (
              <SyncIcon />
            )
          }
          onClick={refresh}
          sx={{ color: '#2A9D8F', borderColor: '#2A9D8F', '&:hover': { borderColor: '#2A9D8F', bgcolor: 'rgba(42,157,143,0.08)' } }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Box>

      {teamsBoardError && (
        <Alert severity="warning" sx={{ width: '100%' }} onClose={dismissTeamsBoardError}>
          {teamsBoardError}
        </Alert>
      )}

      {pending.length > 0 && (
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
