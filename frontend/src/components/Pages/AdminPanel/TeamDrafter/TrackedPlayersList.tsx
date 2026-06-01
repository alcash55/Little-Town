import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { BingoPlayer, BingoTeam, SideAccount } from './useTeamDrafter';
import {
  mutedText,
  selectSx,
  tableCellSx,
  textPrimary,
  textSecondary,
} from './teamDrafterStyles';

export type TrackedPlayersListProps = {
  players: BingoPlayer[];
  teams: BingoTeam[];
  teamNameById: Record<string, string>;
  sideAccountsByPlayerId: Record<string, SideAccount[]>;
  removingRsn: string | null;
  captainUpdatingRsn: string | null;
  onRemovePlayer: (rsn: string) => void;
  onOpenSideAccountDialog: (player: BingoPlayer) => void;
  onSetPlayerCaptain: (rsn: string, captainTeamId: string | null) => void;
};

function CaptainSelect({
  player,
  teams,
  teamNameById,
  captainUpdatingRsn,
  onSetPlayerCaptain,
  fullWidth,
}: {
  player: BingoPlayer;
  teams: BingoTeam[];
  teamNameById: Record<string, string>;
  captainUpdatingRsn: string | null;
  onSetPlayerCaptain: (rsn: string, captainTeamId: string | null) => void;
  fullWidth?: boolean;
}) {
  if (captainUpdatingRsn === player.rsn) {
    return <CircularProgress size={20} sx={{ color: '#2A9D8F' }} />;
  }

  return (
    <FormControl size="small" disabled={teams.length === 0} fullWidth={fullWidth}>
      <Select
        displayEmpty
        value={player.captain_team_id ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          onSetPlayerCaptain(player.rsn, value === '' ? null : value);
        }}
        sx={{ ...selectSx, ...(fullWidth ? { minWidth: 0, width: '100%' } : {}) }}
        renderValue={(selected) => {
          if (!selected) {
            return (
              <Typography variant="body2" sx={{ color: mutedText }}>
                —
              </Typography>
            );
          }
          return teamNameById[selected] ?? '—';
        }}
      >
        <MenuItem value="">
          <Typography variant="body2" sx={{ color: mutedText }}>
            —
          </Typography>
        </MenuItem>
        {teams.map((team) => (
          <MenuItem key={team.id} value={team.id}>
            {team.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SideAccountsCell({ sideAccounts }: { sideAccounts: SideAccount[] }) {
  if (sideAccounts.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: mutedText, fontSize: 13 }}>
        —
      </Typography>
    );
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5}>
      {sideAccounts.map((sa) => (
        <Chip
          key={sa.id}
          label={sa.rsn}
          size="small"
          variant="outlined"
          sx={{
            color: textPrimary,
            borderColor: 'rgba(255,255,255,0.25)',
            fontSize: 12,
          }}
        />
      ))}
    </Stack>
  );
}

function PlayerActions({
  player,
  removingRsn,
  onRemovePlayer,
  onOpenSideAccountDialog,
}: {
  player: BingoPlayer;
  removingRsn: string | null;
  onRemovePlayer: (rsn: string) => void;
  onOpenSideAccountDialog: (player: BingoPlayer) => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent={{ xs: 'flex-start', md: 'center' }}>
      <Tooltip title="Add side account">
        <IconButton
          size="small"
          onClick={() => onOpenSideAccountDialog(player)}
          sx={{ color: '#2A9D8F' }}
        >
          <PersonAddAlt1Icon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Remove from bingo">
        <IconButton
          size="small"
          color="error"
          disabled={removingRsn === player.rsn}
          onClick={() => onRemovePlayer(player.rsn)}
        >
          {removingRsn === player.rsn ? (
            <CircularProgress size={16} />
          ) : (
            <DeleteOutlineIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function MobilePlayerCard({
  player,
  sideAccounts,
  teams,
  teamNameById,
  removingRsn,
  captainUpdatingRsn,
  onRemovePlayer,
  onOpenSideAccountDialog,
  onSetPlayerCaptain,
}: {
  player: BingoPlayer;
  sideAccounts: SideAccount[];
  teams: BingoTeam[];
  teamNameById: Record<string, string>;
  removingRsn: string | null;
  captainUpdatingRsn: string | null;
  onRemovePlayer: (rsn: string) => void;
  onOpenSideAccountDialog: (player: BingoPlayer) => void;
  onSetPlayerCaptain: (rsn: string, captainTeamId: string | null) => void;
}) {
  const fieldLabelSx = {
    color: textSecondary,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    mb: 0.25,
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.03)',
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1.5}>
          <Typography variant="subtitle1" sx={{ color: textPrimary, fontWeight: 600, wordBreak: 'break-word' }}>
            {player.rsn}
          </Typography>
          <PlayerActions
            player={player}
            removingRsn={removingRsn}
            onRemovePlayer={onRemovePlayer}
            onOpenSideAccountDialog={onOpenSideAccountDialog}
          />
        </Stack>

        <Stack spacing={1.25}>
          <Box>
            <Typography sx={fieldLabelSx}>Tracked</Typography>
            <Typography variant="body2" sx={{ color: textPrimary }}>
              {new Date(player.registered_at).toLocaleDateString()}
            </Typography>
          </Box>

          <Box>
            <Typography sx={fieldLabelSx}>Team Captain</Typography>
            {player.captain_team_id ? (
              <Chip label="Yes" size="small" color="success" variant="outlined" />
            ) : (
              <Typography variant="body2" sx={{ color: mutedText }}>
                No
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={fieldLabelSx}>Captain For</Typography>
            <CaptainSelect
              player={player}
              teams={teams}
              teamNameById={teamNameById}
              captainUpdatingRsn={captainUpdatingRsn}
              onSetPlayerCaptain={onSetPlayerCaptain}
              fullWidth
            />
          </Box>

          <Box>
            <Typography sx={fieldLabelSx}>Side Accounts</Typography>
            <SideAccountsCell sideAccounts={sideAccounts} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function TrackedPlayersList({
  players,
  teams,
  teamNameById,
  sideAccountsByPlayerId,
  removingRsn,
  captainUpdatingRsn,
  onRemovePlayer,
  onOpenSideAccountDialog,
  onSetPlayerCaptain,
}: TrackedPlayersListProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Stack spacing={1.5} width="100%">
        {players.map((player) => (
          <MobilePlayerCard
            key={player.id}
            player={player}
            sideAccounts={sideAccountsByPlayerId[player.id] ?? []}
            teams={teams}
            teamNameById={teamNameById}
            removingRsn={removingRsn}
            captainUpdatingRsn={captainUpdatingRsn}
            onRemovePlayer={onRemovePlayer}
            onOpenSideAccountDialog={onOpenSideAccountDialog}
            onSetPlayerCaptain={onSetPlayerCaptain}
          />
        ))}
      </Stack>
    );
  }

  return (
    <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            {[
              'RSN',
              'Tracked',
              'Team Captain',
              'Captain For',
              'Side Accounts',
              'Add',
              'Remove',
            ].map((h, i) => (
              <TableCell
                key={h}
                align={i >= 4 ? 'center' : 'left'}
                sx={{ ...tableCellSx, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {players.map((player) => (
            <TableRow
              key={player.id}
              sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}
            >
              <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap' }}>{player.rsn}</TableCell>
              <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap' }}>
                {new Date(player.registered_at).toLocaleDateString()}
              </TableCell>
              <TableCell sx={tableCellSx}>
                {player.captain_team_id ? (
                  <Chip label="Yes" size="small" color="success" variant="outlined" />
                ) : (
                  <Typography variant="body2" sx={{ color: mutedText, fontSize: 13 }}>
                    No
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={tableCellSx}>
                <CaptainSelect
                  player={player}
                  teams={teams}
                  teamNameById={teamNameById}
                  captainUpdatingRsn={captainUpdatingRsn}
                  onSetPlayerCaptain={onSetPlayerCaptain}
                />
              </TableCell>
              <TableCell sx={tableCellSx}>
                <SideAccountsCell sideAccounts={sideAccountsByPlayerId[player.id] ?? []} />
              </TableCell>
              <TableCell sx={{ ...tableCellSx, textAlign: 'center' }}>
                <Tooltip title="Add side account">
                  <IconButton
                    size="small"
                    onClick={() => onOpenSideAccountDialog(player)}
                    sx={{ color: '#2A9D8F' }}
                  >
                    <PersonAddAlt1Icon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ ...tableCellSx, textAlign: 'center' }}>
                <Tooltip title="Remove from bingo">
                  <IconButton
                    size="small"
                    color="error"
                    disabled={removingRsn === player.rsn}
                    onClick={() => onRemovePlayer(player.rsn)}
                  >
                    {removingRsn === player.rsn ? (
                      <CircularProgress size={16} />
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
