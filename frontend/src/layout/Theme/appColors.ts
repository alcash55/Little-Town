/**
 * Shared design tokens for the dark theme's teal accent + on-dark text/border
 * scale. Promoted from a page-local `appColors` const in TeamData.tsx (the
 * TODO that used to mark this spot) now that the theme rework has landed —
 * see layout/Theme/theme.tsx for the actual MUI theme (palette.mode: 'dark'
 * etc.) these tokens are meant to sit alongside.
 *
 * Pages should prefer these over redefining their own copies so accent/text
 * colors stay in sync app-wide.
 */
export const appColors = {
  accent: '#2A9D8F',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  mutedText: 'rgba(255,255,255,0.5)',
  /** Faint dividers/grid lines (chart axes, section rules). */
  subtleBorder: 'rgba(255,255,255,0.12)',
  /**
   * More visible border used for card/table/input outlines. Sprint 6:
   * folded in from the TeamDrafter page's page-local `subtleBorder` (same
   * concept, different opacity than the one above — kept as a distinct
   * token instead of collapsing the two, since several pages rely on the
   * stronger contrast for outlined cards/tables). See teamDrafterStyles.ts.
   */
  cardBorder: 'rgba(255,255,255,0.23)',
};
