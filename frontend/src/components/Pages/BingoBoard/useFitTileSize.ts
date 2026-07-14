import { RefObject, useEffect, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';

interface FitTileSizeOptions {
  /** Grid columns (== rows for the square boards this app builds). */
  columns: number;
  /** Grid rows — usually equal to `columns`, kept separate in case of a short last row. */
  rows: number;
  /** Grid gap, in px, matching whatever the caller renders. */
  gapPx: number;
  /** Below this, tiles stop being legible — bail out to the scrolling fallback instead. */
  minTileSize: number;
  /** Cap so tiles don't sprawl huge on very tall/short-board viewports. */
  maxTileSize: number;
}

/**
 * Desktop-only tile auto-sizing (Alex's ask: "a little smaller so they all
 * fit in one look of the screen"). Measures the live space below
 * `containerRef`'s top edge and its own width, so a typical 4x4/5x5 board's
 * tiles shrink just enough for the full grid + page header to fit one
 * desktop viewport (~800-1080px tall) without vertical scrolling — rather
 * than the previous fixed-fraction tiles that ran the last row off-screen.
 *
 * Uses `getBoundingClientRect().top` rather than re-deriving PageLayout's
 * own toolbar/impersonation-banner/padding math: the container's actual
 * screen position already nets all of that out, so this stays correct if
 * PageLayout's offsets ever change.
 *
 * Below `minTileSize` (e.g. a 10x10 board, which can't fit legibly) this
 * backs off and returns `null`, letting the caller fall back to the
 * original CSS aspect-ratio/maxWidth layout, which scrolls instead of
 * squashing tiles unreadably.
 *
 * Mobile is intentionally untouched (gated by the `sm` breakpoint) — the
 * board's mobile strategy (see BingoBoard.tsx) is a fixed, always-scrolling
 * grid, and that's out of scope for this fit change.
 */
export function useFitTileSize(
  containerRef: RefObject<HTMLElement | null>,
  { columns, rows, gapPx, minTileSize, maxTileSize }: FitTileSizeOptions,
): number | null {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [tileSize, setTileSize] = useState<number | null>(null);

  useEffect(() => {
    if (!isDesktop) {
      setTileSize(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const recompute = () => {
      const rect = el.getBoundingClientRect();
      // Breathing room for PageLayout's own bottom padding (p: { sm: 5 } =
      // 40px, see PageLayout.tsx) so the last row doesn't sit flush against
      // the viewport edge.
      const bottomBuffer = 40;
      const availableHeight = window.innerHeight - rect.top - bottomBuffer;
      const availableWidth = rect.width;

      const byHeight = (availableHeight - (rows - 1) * gapPx) / rows;
      const byWidth = (availableWidth - (columns - 1) * gapPx) / columns;
      const fit = Math.floor(Math.min(byHeight, byWidth));

      setTileSize(fit < minTileSize ? null : Math.min(fit, maxTileSize));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [isDesktop, containerRef, columns, rows, gapPx, minTileSize, maxTileSize]);

  return tileSize;
}
