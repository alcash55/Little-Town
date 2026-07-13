import { useId, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import { appColors } from '../../../layout/Theme';

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

export interface BingoTileProps {
  task: string;
  completed: boolean;
  /** Name of the caller's own team, for the completed-state detail dialog copy. */
  myTeamName?: string;
}

/**
 * A single board square. Doubles as the long-task-text affordance: a
 * Tooltip surfaces the full task on desktop hover, and the tile itself is a
 * keyboard/tap-reachable button that opens a detail dialog with the full
 * text — the touch (and keyboard) equivalent of the tooltip.
 */
export const BingoTile = ({ task, completed, myTeamName }: BingoTileProps) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const openDetail = () => setOpen(true);
  const closeDetail = () => setOpen(false);

  return (
    <>
      <Tooltip title={task} enterDelay={400} enterTouchDelay={100000} disableInteractive>
        <Box
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-label={
            completed
              ? `${task}. Completed by your team. Activate for details.`
              : `${task}. Activate for details.`
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
            p: { xs: 0.75, sm: 1.5 },
            borderRadius: 2,
            boxSizing: 'border-box',
            overflow: 'hidden',
            cursor: 'pointer',
            outline: 'none',
            border: `1px solid ${
              completed ? alpha(theme.palette.success.light, 0.5) : alpha(appColors.accent, 0.22)
            }`,
            backgroundColor: completed ? completedTileBg(theme) : theme.palette.background.paper,
            // Completed tiles get a diagonal-hatch texture on top of the fill —
            // a pattern cue (not just hue) so the state reads for color-blind
            // users too, at an alpha low enough to keep text contrast intact.
            // Incomplete tiles get a faint accent sheen instead of a flat
            // fill, so an empty square still reads as an inviting, "playable"
            // board slot rather than dead space.
            backgroundImage: completed
              ? `repeating-linear-gradient(135deg, ${alpha(
                  theme.palette.common.white,
                  0.05,
                )} 0px, ${alpha(
                  theme.palette.common.white,
                  0.05,
                )} 2px, transparent 2px, transparent 10px)`
              : `linear-gradient(160deg, ${alpha(appColors.accent, 0.12)} 0%, transparent 70%)`,
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
                bgcolor: alpha(theme.palette.common.black, 0.2),
                transform: 'rotate(-8deg)',
              })}
            >
              <TaskAltIcon sx={{ fontSize: { xs: 14, sm: 18 }, color: appColors.textPrimary }} />
            </Box>
          )}

          <Typography
            variant="body2"
            sx={{
              fontSize: { xs: 11, sm: 13 },
              fontWeight: completed ? 600 : 400,
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: { xs: 3, sm: 5 },
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
          <Typography variant="body1" sx={{ mb: 2 }}>
            {task}
          </Typography>
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
