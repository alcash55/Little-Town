import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import SearchIcon from '@mui/icons-material/Search';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { useTeamData } from './useTeamData';
import { appColors } from '../../../layout/Theme';
import { fmtDate, getTileCell } from './helpers';
import { StatusLegend } from './StatusLegend';
import { TeamDataTable } from './TeamDataTable';
import { TeamDataMobileList } from './TeamDataMobileList';
import { UnlinkedAccountCallout } from './UnlinkedAccountCallout';

const TABLE_MAX_HEIGHT = '62vh';

const TeamData = () => {
  const { data, loading, error, lastUpdated, refresh } = useTeamData();
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);

  const players = useMemo(() => {
    if (!data?.players) return [];
    const q = search.trim().toLowerCase();
    return data.players.filter((p) => !q || p.rsn.toLowerCase().includes(q));
  }, [data, search]);

  const tiles = useMemo(() => {
    if (!data?.tiles) return [];
    if (!hideEmpty) return data.tiles;
    return data.tiles.filter((tile) => players.some((p) => getTileCell(tile, p).state !== 'none'));
  }, [data?.tiles, players, hideEmpty]);

  // `teamId === null` covers two genuinely different causes (TEAM-BRIEF.md
  // Sprint 17, Track B item 3) that resolveMyBingoPlayer() (backend/src/db/players.ts)
  // can both produce: no rsn_claims row for this user at all (`players: []` —
  // the caller isn't linked to any bingo_players row), vs. an RSN that IS
  // claimed but whose player row hasn't been drafted onto a team yet
  // (`players` contains exactly the caller's own row). Only the first is
  // fixed by the onboarding wizard; the second is on an admin to draft, not
  // something "Show intro" can help with, so it gets its own distinct copy
  // instead of silently reusing the unlinked-account CTA or falling through
  // to a one-column table that would render under a blank header (team name
  // is intentionally hidden while teamId is null — see below).
  const isUnlinked = !!data && data.teamId === null && data.players.length === 0;
  const isLinkedButUndrafted = !!data && data.teamId === null && data.players.length > 0;

  return (
    <PageLayout title="My Team" maxWidth="full">
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          width: '100%',
          gap: 1,
        }}
      >
        <Stack spacing={0.25}>
          {/* teamId === null means the caller isn't linked to a player at all —
              UnlinkedAccountCallout below owns that state's messaging, so the
              header doesn't also print the placeholder "Unassigned" as if it
              were a real team name (TEAM-BRIEF.md Sprint 17, Track B item 3). */}
          {data && data.teamId !== null && (
            <Typography variant="body1" sx={{ color: appColors.textPrimary, fontWeight: 600 }}>
              {data.teamName}
            </Typography>
          )}
          {data && (
            <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
              {data.bingoName} · {fmtDate(data.startDate)} → {fmtDate(data.endDate)}
            </Typography>
          )}
          {lastUpdated && (
            <Typography variant="caption" sx={{ color: appColors.mutedText }}>
              Last fetched {fmtDate(lastUpdated.toISOString())}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: appColors.mutedText }} />
                  </InputAdornment>
                ),
              },
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
                {loading ? (
                  <CircularProgress size={20} sx={{ color: appColors.accent }} />
                ) : (
                  <SyncIcon />
                )}
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
        <Typography
          sx={{ color: appColors.textSecondary, textAlign: 'center', width: '100%', mt: 4 }}
        >
          You're not assigned to a team in the active bingo yet.
        </Typography>
      )}

      {isUnlinked && <UnlinkedAccountCallout />}

      {isLinkedButUndrafted && (
        <Typography
          sx={{ color: appColors.textSecondary, textAlign: 'center', width: '100%', mt: 4 }}
        >
          Your RSN is confirmed, but you haven't been drafted onto a team yet — check back once
          an admin sets up teams.
        </Typography>
      )}

      {data && data.teamId !== null && data.players.length === 0 && (
        <Typography
          sx={{ color: appColors.textSecondary, textAlign: 'center', width: '100%', mt: 4 }}
        >
          {data.teamName} doesn't have any players yet.
        </Typography>
      )}

      {data && data.players.length > 0 && !isLinkedButUndrafted && (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              width: '100%',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1,
            }}
          >
            <StatusLegend />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={hideEmpty}
                  onChange={(e) => setHideEmpty(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: appColors.accent },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      bgcolor: appColors.accent,
                    },
                  }}
                />
              }
              label={
                <Typography variant="caption" sx={{ color: appColors.textSecondary }}>
                  Hide tiles with no activity
                </Typography>
              }
              sx={{ ml: 0 }}
            />
          </Stack>

          {players.length === 0 ? (
            <Typography sx={{ color: appColors.textSecondary, width: '100%', mt: 2 }}>
              No players match “{search}”.
            </Typography>
          ) : tiles.length === 0 ? (
            <Typography sx={{ color: appColors.textSecondary, width: '100%', mt: 2 }}>
              No tile has any activity yet for the players shown.
            </Typography>
          ) : (
            <>
              {/* Desktop / tablet: tiles-as-rows × players-as-columns, sticky both ways */}
              <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '100%' }}>
                <TeamDataTable tiles={tiles} players={players} maxHeight={TABLE_MAX_HEIGHT} />
              </Box>

              {/* Mobile: per-player accordion — a pinched grid isn't usable at this width */}
              <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
                <TeamDataMobileList tiles={tiles} players={players} />
              </Box>
            </>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default TeamData;
