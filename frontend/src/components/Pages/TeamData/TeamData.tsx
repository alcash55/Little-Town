import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import SyncIcon from '@mui/icons-material/Sync';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { useTeamData, TileInfo, PlayerRow } from './useTeamData';

// Local palette for this page, matching the dark theme (teal accent #2A9D8F).
// TODO: promote into layout/Theme once the pending theme rework lands.
const appColors = {
  accent: '#2A9D8F',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  mutedText: 'rgba(255,255,255,0.5)',
  subtleBorder: 'rgba(255,255,255,0.12)',
};


// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function fmtProgress(val: number, type: TileInfo['type']): string {
  if (type === 'Experience') {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}m xp`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k xp`;
    return `${val} xp`;
  }
  return String(val);
}

// Encode tile task into a safe DataGrid field name
const tileField = (task: string) => `tile__${task}`;

// ── Cell renderers ────────────────────────────────────────────────────────────

function ProgressCell({ val, tile }: { val: number; tile: TileInfo }) {
  if (!val) return <Typography variant="caption" sx={{ color: appColors.mutedText }}>—</Typography>;
  const pct = tile.target ? Math.min(100, Math.round((val / tile.target) * 100)) : null;
  return (
    <Stack spacing={0.25} sx={{ width: '100%', pr: 0.5 }}>
      <Chip
        label={fmtProgress(val, tile.type)}
        size="small"
        sx={{ bgcolor: 'rgba(42,157,143,0.15)', color: appColors.accent, fontSize: 11, height: 20 }}
      />
      {pct !== null && (
        <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
          {pct}%
        </Typography>
      )}
    </Stack>
  );
}

function DropCell({ status }: { status: 'approved' | 'pending' | null }) {
  if (!status) return <Typography variant="caption" sx={{ color: appColors.mutedText }}>—</Typography>;
  if (status === 'approved') {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
        label="Approved"
        size="small"
        sx={{
          bgcolor: 'rgba(46,160,67,0.18)',
          color: '#4caf50',
          fontSize: 11,
          height: 22,
          '& .MuiChip-icon': { color: '#4caf50' },
        }}
      />
    );
  }
  return (
    <Chip
      icon={<HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />}
      label="Pending"
      size="small"
      sx={{
        bgcolor: 'rgba(255,193,7,0.15)',
        color: '#ffb300',
        fontSize: 11,
        height: 22,
        '& .MuiChip-icon': { color: '#ffb300' },
      }}
    />
  );
}

// ── Tile column header ────────────────────────────────────────────────────────

function TileHeader({ tile }: { tile: TileInfo }) {
  const typeColor =
    tile.type === 'Experience' ? '#64b4ff'
    : tile.type === 'Kill Count' ? '#ffa050'
    : '#b39ddb';
  return (
    <Stack spacing={0.25} sx={{ lineHeight: 1.2, py: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          color: appColors.textPrimary,
          fontWeight: 600,
          fontSize: 12,
          whiteSpace: 'normal',
          lineHeight: 1.3,
        }}
      >
        {tile.task}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ color: typeColor, fontSize: 10 }}>
          {tile.type}
        </Typography>
        {tile.target && (
          <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
            · {tile.type === 'Experience' ? fmtProgress(tile.target, tile.type) : `${tile.target} kc`}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TeamData = () => {
  const { data, loading, error, lastUpdated, refresh } = useTeamData();
  const [search, setSearch] = useState('');
  const [dismissedError, setDismissedError] = useState(false);

  // Reset dismissed state whenever the error changes
  useEffect(() => { setDismissedError(false); }, [error]);
  const rows = useMemo(() => {
    if (!data?.players) return [];
    const q = search.trim().toLowerCase();
    return data.players
      .filter((p) => !q || p.rsn.toLowerCase().includes(q))
      .map((p) => ({ id: p.rsn, ...p }));
  }, [data, search]);

  // Columns = one per tile on the board
  const tileCols: GridColDef[] = useMemo(() => {
    if (!data?.tiles) return [];
    return data.tiles.map((tile): GridColDef => ({
      field: tileField(tile.task),
      headerName: tile.task,
      width: 150,
      sortable: false,
      renderHeader: () => <TileHeader tile={tile} />,
      valueGetter: (params) => {
        const row = params.row as PlayerRow;
        if (tile.type === 'Experience') return row.skillDeltas[tile.task] ?? 0;
        if (tile.type === 'Kill Count') return row.activityDeltas[tile.task] ?? 0;
        return row.dropStatus[tile.task] ?? null;
      },
      renderCell: (params: GridRenderCellParams) => {
        if (tile.type === 'Drops') {
          return <DropCell status={params.value as 'approved' | 'pending' | null} />;
        }
        return <ProgressCell val={params.value as number} tile={tile} />;
      },
    }));
  }, [data?.tiles]);

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'rsn',
      headerName: 'Player',
      width: 160,
      renderHeader: () => (
        <Typography
          variant="caption"
          sx={{
            color: appColors.textSecondary,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: 11,
          }}
        >
          Player
        </Typography>
      ),
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as PlayerRow & { id: string };
        return (
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {row.isCaptain && (
              <Tooltip title="Team Captain">
                <StarIcon sx={{ fontSize: 14, color: '#FFD700', flexShrink: 0 }} />
              </Tooltip>
            )}
            <Stack spacing={0}>
              <Typography
                variant="body2"
                sx={{ color: appColors.textPrimary, fontWeight: 600, lineHeight: 1.3 }}
              >
                {row.rsn}
              </Typography>
              {row.snapshotTakenAt && (
                <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
                  {fmt(row.snapshotTakenAt)}
                </Typography>
              )}
            </Stack>
          </Stack>
        );
      },
    },
    ...tileCols,
  ], [tileCols]);

  return (
    <PageLayout title="My Team" maxWidth="full">
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        width="100%"
        gap={1}
      >
        <Stack spacing={0.25}>
          {data && (
            <Typography variant="body1" sx={{ color: appColors.textPrimary, fontWeight: 600 }}>
              {data.teamName}
            </Typography>
          )}
          {data && (
            <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
              {data.bingoName} · {fmt(data.startDate)} → {fmt(data.endDate)}
            </Typography>
          )}
          {lastUpdated && (
            <Typography variant="caption" sx={{ color: appColors.mutedText }}>
              Last fetched {fmt(lastUpdated.toISOString())}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <TextField
            size="small"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: appColors.mutedText }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                color: appColors.textPrimary,
                '& fieldset': { borderColor: appColors.subtleBorder },
                '&:hover fieldset': { borderColor: appColors.accent },
                '&.Mui-focused fieldset': { borderColor: appColors.accent },
              },
              '& .MuiInputBase-input::placeholder': { color: appColors.mutedText, opacity: 1 },
            }}
          />
          <Tooltip title="Refresh team data">
            <span>
              <IconButton
                onClick={refresh}
                disabled={loading}
                sx={{
                  color: appColors.accent,
                  border: `1px solid rgba(42,157,143,0.4)`,
                  borderRadius: 2,
                }}
              >
                {loading
                  ? <CircularProgress size={20} sx={{ color: appColors.accent }} />
                  : <SyncIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      )}

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, width: '100%' }}>
          <CircularProgress sx={{ color: appColors.accent }} />
        </Box>
      )}

      {!loading && !error && !data && (
        <Typography sx={{ color: appColors.textSecondary, textAlign: 'center', width: '100%', mt: 4 }}>
          You're not assigned to a team in the active bingo yet.
        </Typography>
      )}

      {data && (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
            rowHeight={60}
            columnHeaderHeight={64}
            hideFooter={rows.length <= 10}
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{
              border: `1px solid ${appColors.subtleBorder}`,
              color: appColors.textPrimary,
              bgcolor: 'rgba(255,255,255,0.02)',
              '& .MuiDataGrid-columnHeaders': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderBottom: `1px solid ${appColors.subtleBorder}`,
              },
              '& .MuiDataGrid-columnHeader': {
                '&:focus, &:focus-within': { outline: 'none' },
              },
              '& .MuiDataGrid-columnSeparator': { color: appColors.subtleBorder },
              '& .MuiDataGrid-cell': {
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
                '&:focus, &:focus-within': { outline: 'none' },
              },
              '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(42,157,143,0.05)' },
              '& .MuiDataGrid-footerContainer': {
                borderTop: `1px solid ${appColors.subtleBorder}`,
              },
              '& .MuiTablePagination-root': { color: appColors.mutedText },
              '& .MuiTablePagination-actions button': { color: appColors.mutedText },
            }}
          />
        </Box>
      )}
    </PageLayout>
  );
};

export default TeamData;
