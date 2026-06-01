import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTeamDrafter } from './useTeamDrafter';
import { SideAccountsDialog } from './SideAccountsDialog';
import { TrackedPlayersList } from './TrackedPlayersList';
import {
  cardSx,
  inputSx,
  outlinedButtonSx,
  textPrimary,
  textSecondary,
} from './teamDrafterStyles';

export function PlayerManagementTab(props: ReturnType<typeof useTeamDrafter>) {
  const {
    players,
    loadingPlayers,
    csvInput,
    setCsvInput,
    addingPlayers,
    addPlayerError,
    addResults,
    addPlayersFromCsv,
    removingRsn,
    removePlayer,
    sideAccountPlayer,
    sideAccounts,
    loadingSideAccounts,
    newSideRsn,
    setNewSideRsn,
    newSideNotes,
    setNewSideNotes,
    addingSideAccount,
    sideAccountError,
    openSideAccountDialog,
    closeSideAccountDialog,
    addSideAccount,
    removeSideAccount,
    sideAccountsByPlayerId,
    teams,
    teamNameById,
    setPlayerCaptain,
    captainUpdatingRsn,
  } = props;

  const parsedCount = csvInput
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h2" sx={{ fontSize: 20, mb: 0.5, color: textPrimary }}>
            Track Players
          </Typography>
          <Typography variant="body1" sx={{ color: textSecondary, mb: 2, fontSize: 14 }}>
            Paste a comma or newline-separated list of RSNs. Each account will be tracked for the
            active bingo and have its starting hiscore snapshot taken.
          </Typography>

          <TextField
            multiline
            minRows={4}
            fullWidth
            placeholder={'Zezima, Woox\nPinkydaWizard\nB0aty'}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            sx={{ mb: 2, ...inputSx }}
          />

          {addPlayerError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {addPlayerError}
            </Alert>
          )}

          <Button
            variant="outlined"
            color="success"
            disabled={addingPlayers || parsedCount === 0}
            startIcon={addingPlayers ? <CircularProgress size={16} /> : undefined}
            onClick={addPlayersFromCsv}
            sx={outlinedButtonSx}
          >
            {addingPlayers
              ? 'Adding...'
              : `Track ${parsedCount > 0 ? parsedCount : ''} Player${parsedCount !== 1 ? 's' : ''}`}
          </Button>

          {Object.keys(addResults).length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {Object.entries(addResults).map(([rsn, result]) => (
                <Chip
                  key={rsn}
                  size="small"
                  icon={
                    result === 'ok' ? (
                      <CheckCircleOutlineIcon fontSize="small" />
                    ) : (
                      <ErrorOutlineIcon fontSize="small" />
                    )
                  }
                  label={
                    result === 'ok'
                      ? rsn
                      : result.includes('authorized')
                        ? `${rsn}: not authorized by the admin API`
                        : `${rsn}: ${result}`
                  }
                  color={result === 'ok' ? 'success' : 'error'}
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h2" sx={{ fontSize: 20, mb: 2, color: textPrimary }}>
            Tracked Players{' '}
            {!loadingPlayers && (
              <Typography component="span" variant="body1" sx={{ color: textSecondary, fontSize: 14 }}>
                ({players.length})
              </Typography>
            )}
          </Typography>

          {loadingPlayers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} sx={{ color: '#2A9D8F' }} />
            </Box>
          ) : players.length === 0 ? (
            <Typography variant="body1" sx={{ color: textSecondary }}>
              No players tracked yet.
            </Typography>
          ) : (
            <TrackedPlayersList
              players={players}
              teams={teams}
              teamNameById={teamNameById}
              sideAccountsByPlayerId={sideAccountsByPlayerId}
              removingRsn={removingRsn}
              captainUpdatingRsn={captainUpdatingRsn}
              onRemovePlayer={removePlayer}
              onOpenSideAccountDialog={openSideAccountDialog}
              onSetPlayerCaptain={setPlayerCaptain}
            />
          )}
        </CardContent>
      </Card>

      {sideAccountPlayer && (
        <SideAccountsDialog
          player={sideAccountPlayer}
          sideAccounts={sideAccounts}
          loadingSideAccounts={loadingSideAccounts}
          newSideRsn={newSideRsn}
          setNewSideRsn={setNewSideRsn}
          newSideNotes={newSideNotes}
          setNewSideNotes={setNewSideNotes}
          addingSideAccount={addingSideAccount}
          sideAccountError={sideAccountError}
          onAdd={addSideAccount}
          onRemove={removeSideAccount}
          onClose={closeSideAccountDialog}
        />
      )}
    </Box>
  );
}
