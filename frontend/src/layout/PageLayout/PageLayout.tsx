import { Alert, CircularProgress, Stack, SxProps, Theme, Typography } from '@mui/material';
import { darkTheme } from '../Theme/theme';
import { ReactNode } from 'react';
import { BingoUpdated } from '../../components/BingoUpdated/BingoUpdated';

interface PageLayoutProps {
  children: ReactNode;
  /** Page heading — omit for pages that define their own title in children */
  title?: string;
  /** Label for the BingoUpdated success screen e.g. 'Board', 'Details' */
  bingoItem?: string;
  /** Show the pre-existing data warning alert */
  showExistingWarning?: boolean;
  /** Custom warning message — defaults to a sensible message using bingoItem */
  warningMessage?: string;
  /** Surface API errors */
  error?: string | null;
  /** Replaces content with a centred spinner */
  loading?: boolean;
  /** Show the success screen after submit */
  submitted?: boolean;
  /** true = PUT (modify), false = POST (create) */
  isUpdated?: boolean;
  /**
   * Max width of the content column. Defaults to 500px (forms).
   * Use 'full' for grids, charts, or drag-and-drop layouts.
   */
  maxWidth?: number | 'full';
  /**
   * 'top'    — content starts at the top (default, suits forms)
   * 'center' — content is vertically centred (suits empty/error states)
   */
  align?: 'top' | 'center';
  /** Extra sx on the inner content column */
  contentSx?: SxProps<Theme>;
  /**
   * Future additions worth considering:
   * - breadcrumbs prop for nested admin pages
   * - actionSlot: ReactNode for top-right page-level buttons (Refresh, Export)
   * - skeleton prop for per-section loading instead of full-page spinner
   * - document title sync via useEffect + document.title
   * - scrollToTop on mount
   * - fadeIn animation wrapper on mount
   * - successMessage override for BingoUpdated
   * - toast/snackbar slot for non-blocking success/error feedback
   */
}

const PageLayout = ({
  children,
  title,
  bingoItem,
  showExistingWarning = false,
  warningMessage,
  error,
  loading = false,
  submitted = false,
  isUpdated = false,
  maxWidth = 500,
  align = 'top',
  contentSx,
}: PageLayoutProps) => {
  const contentMaxWidth = maxWidth === 'full' ? '100%' : maxWidth;
  const alertMaxWidth = maxWidth === 'full' ? 500 : contentMaxWidth;

  const resolvedWarning =
    warningMessage ??
    (bingoItem
      ? `A bingo ${bingoItem.toLowerCase()} already exists. Submitting will overwrite it.`
      : 'Existing data was found. Submitting will overwrite it.');

  return (
    <Stack
      width="100%"
      minHeight="100vh"
      justifyContent={align === 'center' ? 'center' : 'flex-start'}
      alignItems="center"
      sx={{
        bgcolor: darkTheme.palette.primary.main,
        p: { xs: 3, sm: 5 },
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {loading ? (
        <Stack flex={1} justifyContent="center" alignItems="center" width="100%">
          <CircularProgress sx={{ color: '#2A9D8F' }} size={56} />
        </Stack>
      ) : submitted && bingoItem ? (
        <BingoUpdated isUpdated={isUpdated} itemUpdated={bingoItem} />
      ) : (
        <Stack
          spacing={3}
          width="100%"
          maxWidth={contentMaxWidth}
          alignItems="center"
          sx={contentSx}
        >
          {title && (
            <Typography variant="h1" sx={{ fontSize: { xs: 32, sm: 42 }, textAlign: 'center' }}>
              {title}
            </Typography>
          )}

          {showExistingWarning && (
            <Alert severity="warning" variant="outlined" sx={{ width: '100%', maxWidth: alertMaxWidth }}>
              {resolvedWarning}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ width: '100%', maxWidth: alertMaxWidth }}>
              {error}
            </Alert>
          )}

          {children}
        </Stack>
      )}
    </Stack>
  );
};

export default PageLayout;
