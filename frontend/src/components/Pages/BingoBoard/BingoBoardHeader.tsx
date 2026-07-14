import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import GroupsIcon from '@mui/icons-material/Groups';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LoginIcon from '@mui/icons-material/Login';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { appColors } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { BingoBoardInfo, BingoBoardTeam } from './useBingoBoard';

export interface BingoBoardHeaderProps {
  bingo: BingoBoardInfo;
  myTeam: BingoBoardTeam | null;
  completedCount: number;
  totalCount: number;
}

/**
 * Page hero: bingo identity, the caller's team badge (or a gentle no-team
 * note), and a compact "meter" progress affordance — dataviz's single-hue
 * Meter form (see BoardProgressGauge.tsx), just in a header-sized bar rather
 * than a radial gauge since this needs to sit inline at a glance, not anchor
 * its own dashboard section.
 *
 * `myTeam: null` covers two different visitors post-Sprint 9 (TEAM-BRIEF.md
 * Track B item 3, the board going public) — a logged-in user just not on a
 * team for this bingo, vs. an anonymous visitor who was never in the
 * running for one. Reads `useLoginModal()` itself (rather than taking an
 * `isAuthenticated` prop) to tell the two apart and show the right gentle
 * nudge for each, same pattern `Bar.tsx` uses for its own logged-out state.
 */
export const BingoBoardHeader = ({
  bingo,
  myTeam,
  completedCount,
  totalCount,
}: BingoBoardHeaderProps) => {
  const { user, openLogin, prefetchLoginModal } = useLoginModal();
  const isAuthenticated = Boolean(user);
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Box
        sx={(theme) => ({
          width: '100%',
          borderRadius: 3,
          border: `1px solid ${appColors.subtleBorder}`,
          background: `linear-gradient(160deg, ${alpha(appColors.accent, 0.14)} 0%, ${
            theme.palette.background.paper
          } 55%)`,
          p: { xs: 2.5, sm: 3.5 },
          boxSizing: 'border-box',
        })}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Stack spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: 26, sm: 34 }, lineHeight: 1.15, wordBreak: 'break-word' }}
            >
              {bingo.name}
            </Typography>
            {myTeam ? (
              <Chip
                icon={<GroupsIcon />}
                label={myTeam.name}
                sx={{
                  bgcolor: alpha(appColors.accent, 0.16),
                  color: appColors.accent,
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: appColors.accent },
                }}
              />
            ) : (
              <Chip
                icon={<InfoOutlinedIcon />}
                label={isAuthenticated ? 'No team assigned' : 'Viewing as a guest'}
                variant="outlined"
                sx={{ borderColor: appColors.cardBorder, color: appColors.textSecondary }}
              />
            )}
          </Stack>

          {myTeam && (
            <Stack spacing={0.75} sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: appColors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  Your progress
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: appColors.textPrimary, fontWeight: 700 }}
                >
                  {completedCount} / {totalCount}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct}
                aria-label={`${myTeam.name} has completed ${completedCount} of ${totalCount} tiles`}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: appColors.subtleBorder,
                  '& .MuiLinearProgress-bar': { bgcolor: appColors.accent, borderRadius: 4 },
                }}
              />
            </Stack>
          )}
        </Stack>
      </Box>

      {!myTeam && isAuthenticated && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="inherit" />}
          sx={{ width: '100%' }}
        >
          You&apos;re not on a team for this bingo yet — the board below is here to explore, but
          nothing will be highlighted for you.
        </Alert>
      )}

      {/* Anonymous visitor: a gentle nudge, not a blocking banner — the
          board underneath is already fully usable (art, tasks, points),
          this is just a pointer at what logging in adds (team highlights). */}
      {!myTeam && !isAuthenticated && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="inherit" />}
          sx={{ width: '100%' }}
          action={
            <Button
              size="small"
              startIcon={<LoginIcon fontSize="small" />}
              onClick={openLogin}
              onMouseEnter={prefetchLoginModal}
              sx={{ color: appColors.accent, whiteSpace: 'nowrap' }}
            >
              Log in
            </Button>
          }
        >
          You&apos;re viewing this board as a guest — log in to see your team&apos;s progress
          highlighted.
        </Alert>
      )}

      {myTeam && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TaskAltIcon sx={(theme) => ({ fontSize: 16, color: theme.palette.success.light })} />
          <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
            Filled, checked tiles are completed by {myTeam.name}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};
