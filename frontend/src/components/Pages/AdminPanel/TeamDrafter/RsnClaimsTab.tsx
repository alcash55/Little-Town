import { Alert, Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTeamDrafter } from './useTeamDrafter';
import { RsnClaimsList } from './RsnClaimsList';
import { ReassignRsnClaimDialog, ReleaseRsnClaimDialog } from './RsnClaimDialogs';
import { cardSx, textPrimary, textSecondary } from './teamDrafterStyles';

/**
 * RSN claims administration (TEAM-BRIEF.md Sprint 17, Track B2):
 *   1. Release/reassign a claimed RSN against the frozen
 *      GET|DELETE|PATCH /api/admin/rsn-claims contract.
 *   2. Flag pool players nobody has actually claimed, so Alex knows who to
 *      chase — there's no route joining bingo_players to rsn_claims, so
 *      this is the client-side match the brief points at (see
 *      normalizeRsnForMatch in useTeamDrafter.ts).
 */
export function RsnClaimsTab(props: ReturnType<typeof useTeamDrafter>) {
  const {
    unclaimedPlayers,
    loadingPlayers,
    rsnClaims,
    loadingRsnClaims,
    rsnClaimsError,
    adminUsers,
    loadingAdminUsers,
    adminUsersError,
    releaseClaimTarget,
    releasingClaim,
    releaseClaimError,
    openReleaseClaimDialog,
    closeReleaseClaimDialog,
    confirmReleaseClaim,
    reassignClaimTarget,
    reassignClaimUser,
    setReassignClaimUser,
    reassigningClaim,
    reassignClaimError,
    openReassignClaimDialog,
    closeReassignClaimDialog,
    confirmReassignClaim,
  } = props;

  const loadingUnclaimed = loadingPlayers || loadingRsnClaims;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h2" sx={{ fontSize: 20, mb: 0.5, color: textPrimary }}>
            Unclaimed Players
          </Typography>
          <Typography variant="body1" sx={{ color: textSecondary, mb: 2, fontSize: 14 }}>
            Tracked for this bingo but no real account has confirmed the RSN — an admin typed these
            in directly, so these players never see their own team data until they claim it from
            onboarding.
          </Typography>

          {loadingUnclaimed ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} sx={{ color: '#2A9D8F' }} />
            </Box>
          ) : unclaimedPlayers.length === 0 ? (
            <Typography variant="body1" sx={{ color: textSecondary }}>
              Every tracked player has a confirmed claim.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {unclaimedPlayers.map((p) => (
                <Chip
                  key={p.id}
                  size="small"
                  icon={<WarningAmberIcon fontSize="small" />}
                  label={p.rsn}
                  color="warning"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h2" sx={{ fontSize: 20, mb: 0.5, color: textPrimary }}>
            RSN Claims{' '}
            {!loadingRsnClaims && (
              <Typography
                component="span"
                variant="body1"
                sx={{ color: textSecondary, fontSize: 14 }}
              >
                ({rsnClaims.length})
              </Typography>
            )}
          </Typography>
          <Typography variant="body1" sx={{ color: textSecondary, mb: 2, fontSize: 14 }}>
            Every account currently linked to an RSN, system-wide. Release frees the name for anyone
            to claim again; reassign moves it straight to a different account.
          </Typography>

          {rsnClaimsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rsnClaimsError}
            </Alert>
          )}

          {loadingRsnClaims ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} sx={{ color: '#2A9D8F' }} />
            </Box>
          ) : rsnClaims.length === 0 ? (
            <Typography variant="body1" sx={{ color: textSecondary }}>
              No RSN claims yet.
            </Typography>
          ) : (
            <RsnClaimsList
              claims={rsnClaims}
              onRelease={openReleaseClaimDialog}
              onReassign={openReassignClaimDialog}
            />
          )}
        </CardContent>
      </Card>

      {releaseClaimTarget && (
        <ReleaseRsnClaimDialog
          claim={releaseClaimTarget}
          releasing={releasingClaim}
          error={releaseClaimError}
          onConfirm={confirmReleaseClaim}
          onClose={closeReleaseClaimDialog}
        />
      )}

      {reassignClaimTarget && (
        <ReassignRsnClaimDialog
          claim={reassignClaimTarget}
          users={adminUsers}
          loadingUsers={loadingAdminUsers}
          usersError={adminUsersError}
          selectedUser={reassignClaimUser}
          onSelectUser={setReassignClaimUser}
          reassigning={reassigningClaim}
          error={reassignClaimError}
          onConfirm={confirmReassignClaim}
          onClose={closeReassignClaimDialog}
        />
      )}
    </Box>
  );
}
