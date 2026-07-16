import { alpha } from '@mui/material/styles';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { appColors } from '../../../../layout/Theme';
import { useScreenshotSubmission } from './useScreenshotSubmission';
import { ScreenshotCard } from './ScreenshotCard';
import { UnattributedCard } from './UnattributedCard';

const ScreenshotSubmission = () => {
  const {
    pending,
    unattributed,
    unattributedError,
    dismissUnattributedError,
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
    attributionSelection,
    setPlayerForAttribution,
    attributing,
    attributionError,
    dismissAttributionError,
    attribute,
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
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          width: '100%',
        }}
      >
        <Typography variant="body2" sx={{ color: textSecondary, minWidth: 0 }}>
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
            flexShrink: 0,
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

      {/* ── Attribution worklist load failure — previously silent (see
          useScreenshotSubmission's fetchUnattributed doc comment): a failed
          GET .../unattributed looked identical to "nothing to attribute",
          which is exactly the kind of silent failure that could leave real
          unattributed submissions invisible to an admin. ── */}
      {unattributedError && (
        <Alert severity="warning" sx={{ width: '100%' }} onClose={dismissUnattributedError}>
          {unattributedError}
        </Alert>
      )}

      {/* ── Attribution backfill (bug-report investigation, H1): approved
          submissions with no player picked. Already counted at the team
          level (BingoOverview's team totals); this is how an admin fills in
          the per-player link after the fact. Rendered as a SIBLING of the
          pending-queue block above (not nested inside its empty-state
          branch), so this worklist is visible even when "All caught up"
          (zero pending) is also true — the two states are independent. ── */}
      {unattributed.length > 0 && (
        <>
          <Typography variant="h3" sx={{ fontSize: 18, width: '100%', mt: 2 }}>
            Needs Player Attribution
          </Typography>
          <Typography variant="body2" sx={{ color: textSecondary, width: '100%' }}>
            {unattributed.length} approved submission{unattributed.length > 1 ? 's were' : ' was'}{' '}
            approved without picking a player — already counted for the team, but won&apos;t show up
            per-player until attributed here.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              width: '100%',
            }}
          >
            {unattributed.map((submission) => (
              <UnattributedCard
                key={submission.id}
                submission={submission}
                players={players}
                playerId={attributionSelection[submission.id]}
                onPlayerChange={(playerId) => setPlayerForAttribution(submission.id, playerId)}
                onAttribute={() => attribute(submission.id)}
                isAttributing={attributing === submission.id}
                error={attributionError[submission.id]}
                onDismissError={() => dismissAttributionError(submission.id)}
              />
            ))}
          </Box>
        </>
      )}
    </PageLayout>
  );
};

export default ScreenshotSubmission;
