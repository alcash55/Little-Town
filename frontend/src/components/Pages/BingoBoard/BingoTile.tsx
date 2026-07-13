import { useId, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { appColors } from '../../../layout/Theme';
import { resolveBingoArt } from '../../../data/bingoArt';

// `theme.palette.success.dark` alone is only ~4.1:1 against white text — short
// of WCAG AA's 4.5:1 at this tile text's size. Darken the token itself
// (rather than hardcoding a new hex) to ~5.97:1, comfortably passing, while
// still tracking the theme's success color if it ever changes.
//
// The completed-tile text/icon color must stay a fixed light color
// (appColors.textPrimary) rather than `theme.palette.success.contrastText`:
// in this theme success.contrastText resolves to ~87%-black (MUI derives it
// from the *unmodified* success.main), which only reaches ~3.5:1 against
// this darkened green — a silent AA regression the previous implementation
// had. See DESIGN NOTES in the sprint report.
const completedTileBg = (theme: { palette: { success: { dark: string } } }) =>
  darken(theme.palette.success.dark, 0.2);

/**
 * Compact number formatting for the points badge, matching the old Excel
 * board's "1.5K Points" / "5M XP" style rather than raw digit strings.
 */
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimDecimal(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimDecimal(n / 1_000)}K`;
  return `${n}`;
}
function trimDecimal(n: number): string {
  return n % 1 === 0 ? `${n}` : n.toFixed(1);
}

function targetLabel(
  type: BingoTileProps['type'],
  targetValue: number | null | undefined,
): string | null {
  if (targetValue == null) return null;
  if (type === 'Kill Count') return `Target: ${targetValue.toLocaleString()} KC`;
  if (type === 'Experience') return `Target: ${targetValue.toLocaleString()} XP`;
  if (type === 'Drops') return `Target: ${targetValue.toLocaleString()}`;
  return null;
}

export interface BingoTileProps {
  task: string;
  completed: boolean;
  /** Name of the caller's own team, for the completed-state detail dialog copy. */
  myTeamName?: string;
  /** Point value of the tile — always shown (TEAM-BRIEF.md Sprint 8, Track A item 3). */
  points: number;
  /** Tile category, used for the detail dialog's target line and art fallback logic. */
  type?: 'Kill Count' | 'Experience' | 'Drops';
  /** The KC/XP/drop-count goal for the tile, if the board defines one. */
  targetValue?: number | null;
}

/**
 * A single board square. Doubles as the long-task-text affordance: a
 * Tooltip surfaces the full task on desktop hover, and the tile itself is a
 * keyboard/tap-reachable button that opens a detail dialog with the full
 * text — the touch (and keyboard) equivalent of the tooltip.
 *
 * Visual anchor: tiles whose `task` resolves to a curated boss/skill/item
 * render (see `data/bingoArt.ts`) show that artwork as the tile's backdrop,
 * echoing the old Excel board's icon-per-square look. Tasks that don't
 * resolve (most Drops tiles, any typo/one-off text) fall back to the
 * original clean text-only tile — never a broken `<img>`.
 */
export const BingoTile = ({
  task,
  completed,
  myTeamName,
  points,
  type,
  targetValue,
}: BingoTileProps) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const artUrl = useMemo(() => resolveBingoArt(task), [task]);
  const hasArt = Boolean(artUrl);

  const openDetail = () => setOpen(true);
  const closeDetail = () => setOpen(false);

  const pointsLabel = `${formatCompact(points)} point${points === 1 ? '' : 's'}`;
  const target = targetLabel(type, targetValue);

  return (
    <>
      <Tooltip title={task} enterDelay={400} enterTouchDelay={100000} disableInteractive>
        <Box
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-label={
            completed
              ? `${task}. Worth ${pointsLabel}. Completed by your team. Activate for details.`
              : `${task}. Worth ${pointsLabel}. Activate for details.`
          }
          onClick={openDetail}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetail();
            }
          }}
          sx={(theme) => ({
            position: 'relative',
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            borderRadius: 2,
            boxSizing: 'border-box',
            overflow: 'hidden',
            cursor: 'pointer',
            outline: 'none',
            border: `1px solid ${
              completed ? alpha(theme.palette.success.light, 0.5) : alpha(appColors.accent, 0.22)
            }`,
            // Solid completed fill only applies to text-only tiles — an art
            // tile keeps its neutral paper base so the artwork stays
            // visible; the completed cue there comes from the green wash +
            // hatch overlay + bottom scrim + check badge layered on top
            // instead (still non-color-only: pattern + icon either way).
            backgroundColor:
              completed && !hasArt ? completedTileBg(theme) : theme.palette.background.paper,
            backgroundImage:
              completed && !hasArt
                ? // Completed, text-only: diagonal-hatch texture on the flat
                  // fill — a pattern cue (not just hue) so the state reads
                  // for color-blind users too.
                  `repeating-linear-gradient(135deg, ${alpha(
                    theme.palette.common.white,
                    0.05,
                  )} 0px, ${alpha(
                    theme.palette.common.white,
                    0.05,
                  )} 2px, transparent 2px, transparent 10px)`
                : !completed && !hasArt
                ? // Incomplete, text-only: faint accent sheen so an empty
                  // square still reads as an inviting, "playable" board
                  // slot rather than dead space.
                  `linear-gradient(160deg, ${alpha(appColors.accent, 0.12)} 0%, transparent 70%)`
                : 'none',
            color: appColors.textPrimary,
            boxShadow: completed
              ? `0 2px 10px ${alpha(theme.palette.success.dark, 0.45)}, inset 0 1px 0 ${alpha(
                  theme.palette.common.white,
                  0.06,
                )}`
              : `0 1px 3px ${alpha(theme.palette.common.black, 0.4)}`,
            transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              borderColor: completed ? theme.palette.success.light : appColors.accent,
              boxShadow: completed
                ? `0 6px 16px ${alpha(theme.palette.success.dark, 0.55)}`
                : `0 6px 16px ${alpha(appColors.accent, 0.25)}`,
              '& .bingo-tile-expand-hint': { opacity: 0.85 },
            },
            // The accent teal ring reads clearly against incomplete tiles' near-black
            // background (~5.2:1), but the same ring at the same alpha only hits ~1.8:1
            // against a *completed* tile's mid-green fill — under WCAG's 3:1 non-text
            // contrast guidance for focus indicators (SC 1.4.11). Completed tiles get a
            // white ring instead (~6:1 against the green fill) so the keyboard-focus
            // state stays legible on every tile, not just empty ones.
            '&:focus-visible': {
              borderColor: completed ? theme.palette.common.white : appColors.accent,
              boxShadow: completed
                ? `0 0 0 3px ${alpha(theme.palette.common.white, 0.75)}`
                : `0 0 0 3px ${alpha(appColors.accent, 0.45)}`,
            },
          })}
        >
          {hasArt && (
            <Box
              component="img"
              src={artUrl}
              alt=""
              aria-hidden
              sx={{
                position: 'absolute',
                top: '4%',
                left: '8%',
                right: '8%',
                height: '58%',
                objectFit: 'contain',
                objectPosition: 'center top',
                pointerEvents: 'none',
                opacity: completed ? 0.82 : 1,
              }}
            />
          )}

          {hasArt && (
            <Box
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '60%',
                pointerEvents: 'none',
                // Neutral black scrim on incomplete tiles (robust against
                // any art hue); a green-tinted scrim on completed tiles
                // doubles as a color cue on top of the hatch + check badge.
                // Both reach ~0.9+ alpha at the bottom edge, where the task
                // text sits, to hold the same ≥4.5:1 white-text contrast
                // the text-only tiles rely on (see completedTileBg above).
                background: completed
                  ? `linear-gradient(to bottom, transparent 0%, ${alpha(
                      completedTileBg(theme),
                      0.6,
                    )} 35%, ${alpha(completedTileBg(theme), 0.95)} 100%)`
                  : `linear-gradient(to bottom, transparent 0%, ${alpha(
                      theme.palette.common.black,
                      0.6,
                    )} 35%, ${alpha(theme.palette.common.black, 0.92)} 100%)`,
              })}
            />
          )}

          {/* Completed hatch texture over art, echoing the text-only tile's
              pattern cue so the state is never color-only even here. */}
          {completed && hasArt && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: `repeating-linear-gradient(135deg, ${alpha(
                  '#ffffff',
                  0.07,
                )} 0px, ${alpha('#ffffff', 0.07)} 2px, transparent 2px, transparent 10px)`,
              }}
            />
          )}

          {/* Points badge — always shown, top-left. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.7,
              py: 0.2,
              borderRadius: 4,
              bgcolor: alpha('#000000', 0.45),
              backdropFilter: hasArt ? 'blur(1px)' : undefined,
            }}
          >
            <StarIcon sx={{ fontSize: { xs: 10, sm: 12 }, color: '#FFD700' }} />
            <Typography
              sx={{
                fontSize: { xs: 9, sm: 10.5 },
                fontWeight: 700,
                lineHeight: 1,
                color: appColors.textPrimary,
              }}
            >
              {formatCompact(points)}
            </Typography>
          </Box>

          {completed && (
            <Box
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                top: 6,
                right: 6,
                width: { xs: 20, sm: 26 },
                height: { xs: 20, sm: 26 },
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.common.black, 0.35),
                transform: 'rotate(-8deg)',
              })}
            >
              <TaskAltIcon sx={{ fontSize: { xs: 14, sm: 18 }, color: appColors.textPrimary }} />
            </Box>
          )}

          <Typography
            variant="body2"
            sx={{
              position: hasArt ? 'absolute' : 'static',
              left: hasArt ? 0 : undefined,
              right: hasArt ? 0 : undefined,
              bottom: hasArt ? 0 : undefined,
              px: hasArt ? { xs: 0.75, sm: 1.25 } : { xs: 0.75, sm: 1.5 },
              pb: hasArt ? { xs: 0.6, sm: 1 } : { xs: 0.75, sm: 1.5 },
              pt: hasArt ? 0 : { xs: 0.75, sm: 1.5 },
              fontSize: { xs: 11, sm: 13 },
              fontWeight: completed ? 600 : 400,
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: hasArt ? { xs: 2, sm: 3 } : { xs: 3, sm: 5 },
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {task}
          </Typography>

          <Box
            aria-hidden
            className="bingo-tile-expand-hint"
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              display: 'flex',
              opacity: 0,
              transition: 'opacity .15s ease',
            }}
          >
            <OpenInFullIcon sx={{ fontSize: 11, color: appColors.mutedText }} />
          </Box>
        </Box>
      </Tooltip>

      <Dialog
        open={open}
        onClose={closeDetail}
        maxWidth="xs"
        fullWidth
        aria-labelledby={titleId}
        slotProps={{
          paper: {
            sx: (theme) => ({
              backgroundColor: theme.palette.background.paper,
              backgroundImage: 'none',
              border: `1px solid ${appColors.subtleBorder}`,
              borderRadius: 3,
            }),
          },
        }}
      >
        <DialogTitle id={titleId} sx={{ pr: 6, position: 'relative' }}>
          Tile details
          <IconButton
            aria-label="Close"
            onClick={closeDetail}
            sx={{ position: 'absolute', top: 8, right: 8, color: appColors.mutedText }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {hasArt && (
            <Box
              component="img"
              src={artUrl}
              alt=""
              aria-hidden
              sx={{
                display: 'block',
                width: '100%',
                maxHeight: 160,
                objectFit: 'contain',
                mb: 2,
              }}
            />
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>
            {task}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              icon={<StarIcon sx={{ color: '#FFD700 !important' }} />}
              label={pointsLabel}
              sx={{
                bgcolor: alpha('#FFD700', 0.14),
                color: appColors.textPrimary,
                fontWeight: 600,
              }}
            />
            {type && (
              <Chip
                label={type}
                variant="outlined"
                sx={{ borderColor: appColors.cardBorder, color: appColors.textSecondary }}
              />
            )}
            {target && (
              <Chip
                label={target}
                variant="outlined"
                sx={{ borderColor: appColors.cardBorder, color: appColors.textSecondary }}
              />
            )}
          </Stack>
          {completed ? (
            <Chip
              icon={<TaskAltIcon />}
              label={`Completed by ${myTeamName ?? 'your team'}`}
              sx={(theme) => ({
                bgcolor: alpha(theme.palette.success.main, 0.18),
                color: theme.palette.success.light,
                fontWeight: 600,
                '& .MuiChip-icon': { color: theme.palette.success.light },
              })}
            />
          ) : (
            <Chip
              label="Not completed yet"
              variant="outlined"
              sx={{ borderColor: appColors.cardBorder, color: appColors.textSecondary }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${appColors.subtleBorder}`, px: 3, pb: 2 }}>
          <Button onClick={closeDetail} sx={{ color: appColors.accent }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
