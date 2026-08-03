import { useState } from 'react';
import { Alert, Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { appColors } from '../../../../layout/Theme';
import { useBingoLifecycle, type LifecycleBingo } from './useBingoLifecycle';
import { EndBingoDialog } from './EndBingoDialog';
import { DeleteBingoDialog } from './DeleteBingoDialog';
import { CloneBingoDialog } from './CloneBingoDialog';

const disabledOutlinedSx = {
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.38)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
};

export type BingoLifecycleProps = {
  /** BingoDetails' currently-loaded bingo (active|draft), or null if none. */
  source: LifecycleBingo | null;
  /** Re-fetches BingoDetails' form state — called after Delete/Clone succeed. */
  onChanged: () => void | Promise<void>;
};

/**
 * End Early / Delete / Clone admin controls (TEAM-BRIEF.md Sprint 17, Track
 * B1).
 *
 * Deliberately NOT gated on `source` at the call site (see BingoDetails.tsx)
 * — a successful Delete's own `onChanged` call is what flips BingoDetails'
 * `isBingo` back to false, and that must not race the success alert off the
 * screen before the admin ever sees the purged counts. This component stays
 * mounted and renders null only once there's truly nothing left to act on
 * AND nothing left to report (`hasBingo` and `hasAnyResult` both false) —
 * everything below (buttons, danger zone, dialogs) additionally requires an
 * actual bingo, so they disappear the moment one no longer exists while any
 * lingering result alert stays up until dismissed.
 */
export function BingoLifecycle({ source, onChanged }: BingoLifecycleProps) {
  const lc = useBingoLifecycle(source, onChanged);
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);

  const hasBingo = !!lc.bingo;
  const hasAnyResult =
    !!lc.endResult ||
    !!lc.endInfo ||
    !!lc.deleteResult ||
    !!lc.cloneResult ||
    lc.cloneConflict;

  if (!hasBingo && !hasAnyResult) return null;

  const isActive = lc.bingo?.status === 'active';

  const handleEndConfirm = async () => {
    const closable = await lc.endEarly();
    if (closable) setEndOpen(false);
  };

  const handleDeleteConfirm = async (typedName: string) => {
    const ok = await lc.deleteBingo(typedName);
    if (ok) setDeleteOpen(false);
  };

  const handleCloneConfirm = async (input: { name: string; startDate: string; endDate: string }) => {
    const closable = await lc.cloneBingo(input);
    if (closable) setCloneOpen(false);
  };

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Divider sx={{ width: '100%', borderColor: appColors.subtleBorder }} />

      {lc.bingo && (
        <>
          <Typography variant="h2" sx={{ fontSize: 20, color: appColors.textPrimary, textAlign: 'center' }}>
            Bingo Lifecycle
          </Typography>
          <Typography variant="body2" sx={{ color: appColors.textSecondary, textAlign: 'center' }}>
            Actions below apply to &quot;{lc.bingo.name}&quot; ({lc.bingo.status ?? 'unknown'}).
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StopCircleOutlinedIcon />}
              disabled={!isActive}
              onClick={() => setEndOpen(true)}
              sx={{ flex: 1, ...disabledOutlinedSx }}
            >
              End Bingo Early
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => setCloneOpen(true)}
              sx={{
                flex: 1,
                color: appColors.accent,
                borderColor: appColors.accent,
                '&:hover': { borderColor: appColors.accent, bgcolor: 'rgba(42,157,143,0.08)' },
              }}
            >
              Clone Board Into New Draft
            </Button>
          </Stack>

          <Box sx={{ width: '100%', border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 2 }}>
            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, mb: 1 }}>
              Danger zone
            </Typography>
            <Typography variant="body2" sx={{ color: appColors.textSecondary, mb: 1.5 }}>
              Permanently deletes this bingo and everything tied to it — teams, tiles, players, submissions, and
              stored screenshots. This cannot be undone.
            </Typography>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete Bingo
            </Button>
          </Box>
        </>
      )}

      {lc.endResult && (
        <Alert severity="success" onClose={lc.dismissEndResult} sx={{ width: '100%' }}>
          Ended &quot;{lc.endResult.name}&quot; early. {lc.endResult.pendingScreenshots} screenshot
          {lc.endResult.pendingScreenshots === 1 ? '' : 's'} still awaiting review.
          {lc.endResult.pendingScreenshots > 0 && (
            <>
              {' '}
              <Button
                component={Link}
                to="/AdminPanel/ScreenshotSubmission"
                size="small"
                sx={{ color: 'inherit', textDecoration: 'underline', p: 0, minWidth: 0 }}
              >
                Review now
              </Button>
            </>
          )}
        </Alert>
      )}
      {lc.endInfo && (
        <Alert severity="info" onClose={lc.dismissEndResult} sx={{ width: '100%' }}>
          {lc.endInfo}
        </Alert>
      )}

      {lc.deleteResult && (
        <Alert severity="success" onClose={lc.dismissDeleteResult} sx={{ width: '100%' }}>
          Deleted 1 bingo, {lc.deleteResult.teams} team{lc.deleteResult.teams === 1 ? '' : 's'},{' '}
          {lc.deleteResult.tiles} tile{lc.deleteResult.tiles === 1 ? '' : 's'}, {lc.deleteResult.players} player
          {lc.deleteResult.players === 1 ? '' : 's'}, {lc.deleteResult.submissions} submission
          {lc.deleteResult.submissions === 1 ? '' : 's'}, {lc.deleteResult.storageObjects} image
          {lc.deleteResult.storageObjects === 1 ? '' : 's'}.
        </Alert>
      )}

      {lc.cloneResult && (
        <Alert severity="success" onClose={lc.dismissCloneResult} sx={{ width: '100%' }}>
          Cloned into new draft &quot;{lc.cloneResult.name}&quot; — {lc.cloneResult.tilesCloned} tile
          {lc.cloneResult.tilesCloned === 1 ? '' : 's'} copied. It&apos;s now loaded above for editing.
        </Alert>
      )}
      {lc.cloneConflict && (
        <Alert severity="warning" onClose={lc.dismissCloneResult} sx={{ width: '100%' }}>
          An active bingo already exists — end or delete it first, then clone again.
        </Alert>
      )}

      {lc.bingo && (
        <>
          <EndBingoDialog
            open={endOpen}
            bingoName={lc.bingo.name}
            ending={lc.ending}
            error={lc.endError}
            onClose={() => setEndOpen(false)}
            onConfirm={handleEndConfirm}
          />
          <DeleteBingoDialog
            open={deleteOpen}
            bingoName={lc.bingo.name}
            deleting={lc.deleting}
            error={lc.deleteError}
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDeleteConfirm}
          />
          <CloneBingoDialog
            open={cloneOpen}
            sourceBingoName={lc.bingo.name}
            cloning={lc.cloning}
            error={lc.cloneError}
            onClose={() => setCloneOpen(false)}
            onConfirm={handleCloneConfirm}
          />
        </>
      )}
    </Stack>
  );
}
