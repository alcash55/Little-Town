import { useEffect, useId, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { appColors } from '../../../layout/Theme';
import { resolveBingoArt } from '../../../data/bingoArt';
import { resolveItemIconUrl, useOsrsItemIdByName } from '../../../data/osrsItemIcons';

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

// Same reasoning as `completedTileBg` above, applied to the warning palette
// for the pending-review state (TEAM-BRIEF.md Sprint 13, Track B item 1):
// `theme.palette.warning.dark` alone (MUI's default dark-mode amber,
// #f57c00) is only ~2.7:1 against white text — well short of AA. Darkening
// it ~5.2:1 (verified against MUI's own `getContrastRatio`) keeps it
// unmistakably warm/amber (never reading as the completed-tile green or the
// incomplete tile's near-black) while passing AA for the tile's white text.
const pendingTileBg = (theme: { palette: { warning: { dark: string } } }) =>
  darken(theme.palette.warning.dark, 0.3);

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

// Below this JS-computed pixel size (see BingoBoard's `useFitTileSize`),
// text/badges switch to the more compact ('xs') tier instead of the roomier
// one — see `tierValue` below.
const COMPACT_TILE_THRESHOLD = 125;

type SizeTier = 'xs' | 'sm';

/**
 * Resolves one of this file's `{ xs, sm }` responsive-size constants to a
 * single concrete value for `tier`, or passes the object straight through
 * for MUI's own viewport-breakpoint responsiveness when `tier` is `null`.
 *
 * Two different things drive tile "compactness" here: on mobile (no `size`
 * prop, `tier` stays `null`) it's the viewport width, exactly as before this
 * change — MUI's `{ xs, sm } sx` object already does that. On desktop, once
 * `BingoBoard` starts sizing tiles itself from available screen space (see
 * `useFitTileSize.ts`), tile size no longer tracks the viewport breakpoint
 * at all (a "sm"-viewport tile could render larger than one on a "xl"
 * viewport with a big board), so compactness there needs to be driven by
 * the actual computed pixel size instead — reusing the same proven
 * mobile-tuned ('xs') values rather than inventing a third tier.
 */
function tierValue<T>(value: { xs: T; sm: T }, tier: SizeTier | null): { xs: T; sm: T } | T {
  return tier ? value[tier] : value;
}

export interface BingoTileProps {
  task: string;
  completed: boolean;
  /**
   * TEAM-BRIEF.md Sprint 13, Track A item 1 (frozen contract) / Track B item
   * 1: true when a screenshot submission for this tile, from the caller's
   * own team, is awaiting admin review (Drops tiles only — KC/XP tiles
   * auto-verify from the hiscores and never go through this state). Ignored
   * whenever `completed` is also true — a completed tile always renders as
   * completed, never pending, even if the caller passes both (defensive;
   * shouldn't happen once a submission is approved, since approval clears
   * the pending state server-side).
   */
  pendingByMyTeam?: boolean;
  /** Name of the caller's own team, for the completed-state detail dialog copy. */
  myTeamName?: string;
  /** Point value of the tile — always shown (TEAM-BRIEF.md Sprint 8, Track A item 3). */
  points: number;
  /** Tile category, used for the detail dialog's target line and art fallback logic. */
  type?: 'Kill Count' | 'Experience' | 'Drops';
  /** The KC/XP/drop-count goal for the tile, if the board defines one. */
  targetValue?: number | null;
  /**
   * The tile's JS-computed square size in px, from BingoBoard's desktop
   * fit-to-viewport sizing (see `useFitTileSize.ts`). Omitted on mobile,
   * where the tile keeps sizing itself from the grid column (`1fr`) and
   * MUI's viewport-breakpoint `{ xs, sm }` responsive values as before.
   */
  size?: number;
}

/**
 * A single board square. Doubles as the long-task-text affordance: a
 * Tooltip surfaces the full task on desktop hover, and the tile itself is a
 * keyboard/tap-reachable button that opens a detail dialog with the full
 * text — the touch (and keyboard) equivalent of the tooltip.
 *
 * Visual anchor: tiles whose `task` resolves to a curated boss/skill/item/
 * activity render (see `data/bingoArt.ts`) show that artwork as the tile's
 * backdrop, echoing the old Excel board's icon-per-square look. A Drops
 * tile with no curated match instead tries the general item-icon fallback
 * (see `data/osrsItemIcons.ts`) — Jagex's tiny (32x32) GE sprite — rendered
 * in the SAME full-bleed art-anchor slot as curated art, so every tile type
 * shares one visual language (Alex's feedback: items previously read as a
 * small bordered badge, visibly different from boss/activity tiles). The
 * sprite is native pixel art, so it's upscaled with `image-rendering:
 * pixelated` rather than smoothed — a crisp blocky enlargement reads as
 * on-brand OSRS pixel art instead of a blurry stretch. Tasks that don't
 * resolve either way (any typo/one-off text, or a resolved match with a
 * failed image load) fall back to the original clean text-only tile —
 * never a broken `<img>`.
 */
export const BingoTile = ({
  task,
  completed,
  pendingByMyTeam,
  myTeamName,
  points,
  type,
  targetValue,
  size,
}: BingoTileProps) => {
  const [open, setOpen] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const titleId = useId();
  // Completed always wins over pending (see the prop doc comment above) —
  // a single boolean rather than a three-state enum keeps every existing
  // `completed` check below correct as-is; only the NEW pending-only
  // branches need this.
  const pending = !completed && Boolean(pendingByMyTeam);
  const artUrl = useMemo(() => resolveBingoArt(task), [task]);
  const hasArt = Boolean(artUrl);
  // See `tierValue` above: `null` preserves the original viewport-driven
  // {xs, sm} responsiveness (mobile, or desktop before the fit-to-viewport
  // hook has measured); a concrete tier applies once `size` is JS-computed.
  const sizeTier: SizeTier | null = size == null ? null : size < COMPACT_TILE_THRESHOLD ? 'xs' : 'sm';

  // Fallback item-icon lookup (TEAM-BRIEF.md Sprint 9, Track B item 2):
  // only Drops tiles that didn't already resolve curated art need it, so
  // boards with no such tiles never pay for the item-mapping fetch at all.
  const needsItemIcon = !hasArt && type === 'Drops';
  const itemIdByName = useOsrsItemIdByName(needsItemIcon);
  const itemIconUrl = useMemo(
    () => (needsItemIcon ? resolveItemIconUrl(task, itemIdByName) : undefined),
    [needsItemIcon, task, itemIdByName],
  );
  useEffect(() => setIconFailed(false), [itemIconUrl]);
  const hasIcon = Boolean(itemIconUrl) && !iconFailed;

  // Unified "this tile has a visual anchor" flag — curated art and the
  // GE-sprite fallback are mutually exclusive (see `needsItemIcon` above)
  // and share the same full-bleed slot/background treatment, differing
  // only in `imageRendering` (see the art `<img>` below).
  const hasVisual = hasArt || hasIcon;
  const visualSrc = artUrl ?? itemIconUrl;

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
              : pending
              ? `${task}. Worth ${pointsLabel}. Pending review for your team. Activate for details.`
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
              completed
                ? alpha(theme.palette.success.light, 0.5)
                : pending
                ? alpha(theme.palette.warning.light, 0.6)
                : alpha(appColors.accent, 0.22)
            }`,
            // Solid completed/pending fill only applies to text-only tiles —
            // an art tile keeps its neutral paper base so the artwork stays
            // visible; the state cue there comes from the tinted wash +
            // bottom scrim + badge layered on top instead (still
            // non-color-only: badge/pattern + icon either way).
            backgroundColor:
              completed && !hasVisual
                ? completedTileBg(theme)
                : pending && !hasVisual
                ? pendingTileBg(theme)
                : theme.palette.background.paper,
            backgroundImage:
              completed && !hasVisual
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
                : !completed && !pending && !hasVisual
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
              : pending
              ? `0 2px 10px ${alpha(theme.palette.warning.dark, 0.45)}, inset 0 1px 0 ${alpha(
                  theme.palette.common.white,
                  0.06,
                )}`
              : `0 1px 3px ${alpha(theme.palette.common.black, 0.4)}`,
            transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              borderColor: completed
                ? theme.palette.success.light
                : pending
                ? theme.palette.warning.light
                : appColors.accent,
              boxShadow: completed
                ? `0 6px 16px ${alpha(theme.palette.success.dark, 0.55)}`
                : pending
                ? `0 6px 16px ${alpha(theme.palette.warning.dark, 0.55)}`
                : `0 6px 16px ${alpha(appColors.accent, 0.25)}`,
              '& .bingo-tile-expand-hint': { opacity: 0.85 },
            },
            // The accent teal ring reads clearly against incomplete tiles' near-black
            // background (~5.2:1), but the same ring at the same alpha only hits ~1.8:1
            // against a *completed* tile's mid-green fill — under WCAG's 3:1 non-text
            // contrast guidance for focus indicators (SC 1.4.11), and ~1.6:1 against
            // the pending tile's amber fill. Completed AND pending tiles both get a
            // white ring instead (~6:1 / ~5.2:1 respectively) so the keyboard-focus
            // state stays legible on every tile, not just empty ones.
            '&:focus-visible': {
              borderColor:
                completed || pending ? theme.palette.common.white : appColors.accent,
              boxShadow:
                completed || pending
                  ? `0 0 0 3px ${alpha(theme.palette.common.white, 0.75)}`
                  : `0 0 0 3px ${alpha(appColors.accent, 0.45)}`,
            },
          })}
        >
          {hasVisual && (
            <Box
              component="img"
              src={visualSrc}
              alt=""
              aria-hidden
              // Only the GE-sprite fallback can 404/error at runtime
              // (curated art is a bundled build asset); hasArt already
              // implies hasIcon is false, so this only ever wires up for
              // the sprite path.
              onError={!hasArt ? () => setIconFailed(true) : undefined}
              sx={{
                position: 'absolute',
                top: '4%',
                left: '8%',
                right: '8%',
                height: '58%',
                objectFit: 'contain',
                objectPosition: 'center top',
                pointerEvents: 'none',
                opacity: completed || pending ? 0.82 : 1,
                // GE sprites are native 32x32 pixel art — a smoothed
                // upscale blurs them, so force a crisp blocky enlargement
                // instead (curated renders are already high-res, so this
                // is a no-op there).
                imageRendering: hasArt ? undefined : 'pixelated',
              }}
            />
          )}

          {hasVisual && (
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
                // any art hue); a green-tinted scrim on completed tiles, or
                // an amber-tinted one on pending tiles, doubles as a color
                // cue on top of the hatch/badge. All reach ~0.9+ alpha at
                // the bottom edge, where the task text sits, to hold the
                // same ≥4.5:1 white-text contrast the text-only tiles rely
                // on (see completedTileBg/pendingTileBg above).
                background: completed
                  ? `linear-gradient(to bottom, transparent 0%, ${alpha(
                      completedTileBg(theme),
                      0.6,
                    )} 35%, ${alpha(completedTileBg(theme), 0.95)} 100%)`
                  : pending
                  ? `linear-gradient(to bottom, transparent 0%, ${alpha(
                      pendingTileBg(theme),
                      0.6,
                    )} 35%, ${alpha(pendingTileBg(theme), 0.95)} 100%)`
                  : `linear-gradient(to bottom, transparent 0%, ${alpha(
                      theme.palette.common.black,
                      0.6,
                    )} 35%, ${alpha(theme.palette.common.black, 0.92)} 100%)`,
              })}
            />
          )}

          {/* Completed hatch texture over art, echoing the text-only tile's
              pattern cue so the state is never color-only even here. Pending
              tiles intentionally skip this pattern — the hourglass badge
              below is their non-color cue, and reusing the same hatch here
              would make pending read as a variant of completed rather than
              its own distinct state. */}
          {completed && hasVisual && (
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
              backdropFilter: hasVisual ? 'blur(1px)' : undefined,
            }}
          >
            <StarIcon sx={{ fontSize: tierValue({ xs: 10, sm: 12 }, sizeTier), color: '#FFD700' }} />
            <Typography
              sx={{
                fontSize: tierValue({ xs: 9, sm: 10.5 }, sizeTier),
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
                width: tierValue({ xs: 20, sm: 26 }, sizeTier),
                height: tierValue({ xs: 20, sm: 26 }, sizeTier),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.common.black, 0.35),
                transform: 'rotate(-8deg)',
              })}
            >
              <TaskAltIcon
                sx={{ fontSize: tierValue({ xs: 14, sm: 18 }, sizeTier), color: appColors.textPrimary }}
              />
            </Box>
          )}

          {/* Pending-review badge — the tile's non-color cue (TEAM-BRIEF.md
              Sprint 13, Track B item 1): an hourglass rather than the
              completed tile's checkmark, so the two "achieved something"
              states never rely on hue alone to tell apart, even for a
              color-blind viewer. Same corner/size/rotation as the completed
              badge for visual consistency, distinguished by icon + the
              tile's amber (vs. green) fill. */}
          {pending && (
            <Box
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                top: 6,
                right: 6,
                width: tierValue({ xs: 20, sm: 26 }, sizeTier),
                height: tierValue({ xs: 20, sm: 26 }, sizeTier),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.common.black, 0.35),
                transform: 'rotate(-8deg)',
              })}
            >
              <HourglassTopIcon
                sx={{ fontSize: tierValue({ xs: 14, sm: 18 }, sizeTier), color: appColors.textPrimary }}
              />
            </Box>
          )}

          <Typography
            variant="body2"
            sx={{
              position: hasVisual ? 'absolute' : 'static',
              left: hasVisual ? 0 : undefined,
              right: hasVisual ? 0 : undefined,
              bottom: hasVisual ? 0 : undefined,
              px: hasVisual
                ? tierValue({ xs: 0.75, sm: 1.25 }, sizeTier)
                : tierValue({ xs: 0.75, sm: 1.5 }, sizeTier),
              pb: hasVisual
                ? tierValue({ xs: 0.6, sm: 1 }, sizeTier)
                : tierValue({ xs: 0.75, sm: 1.5 }, sizeTier),
              pt: hasVisual ? 0 : tierValue({ xs: 0.75, sm: 1.5 }, sizeTier),
              fontSize: tierValue({ xs: 11, sm: 13 }, sizeTier),
              fontWeight: completed ? 600 : 400,
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: hasVisual
                ? tierValue({ xs: 2, sm: 3 }, sizeTier)
                : tierValue({ xs: 3, sm: 5 }, sizeTier),
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
        <DialogContent sx={{ pb: 3 }}>
          {hasVisual && (
            <Box
              component="img"
              src={visualSrc}
              alt=""
              aria-hidden
              onError={!hasArt ? () => setIconFailed(true) : undefined}
              sx={{
                display: 'block',
                width: '100%',
                maxHeight: 160,
                objectFit: 'contain',
                mb: 2,
                // Same crisp-upscale treatment as the tile itself for the
                // GE-sprite fallback — see the tile art `<img>` above.
                imageRendering: hasArt ? undefined : 'pixelated',
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
          ) : pending ? (
            // TEAM-BRIEF.md Sprint 13, Track B item 1: the board tile's
            // yellow/hourglass treatment needs a matching "Pending review"
            // state in this detail dialog too — a screenshot has been
            // submitted for this Drops tile and is awaiting admin approval.
            <Chip
              icon={<HourglassTopIcon />}
              label={`Pending review for ${myTeamName ?? 'your team'}`}
              sx={(theme) => ({
                bgcolor: alpha(theme.palette.warning.main, 0.18),
                color: theme.palette.warning.light,
                fontWeight: 600,
                '& .MuiChip-icon': { color: theme.palette.warning.light },
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
      </Dialog>
    </>
  );
};
