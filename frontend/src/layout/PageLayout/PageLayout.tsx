import { Alert, Box, Stack, SxProps, Theme, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { ReactNode } from 'react';

interface PageLayoutProps {
  children?: ReactNode;
  /** Page heading — omit for pages that define their own title in children */
  title?: string;
  /** Success message shown in a green Alert after submit e.g. 'Details saved!' */
  successMessage?: string;
  /** Show the pre-existing data warning alert */
  showExistingWarning?: boolean;
  /** Custom warning message — defaults to a sensible fallback */
  warningMessage?: string;
  /** Surface API errors */
  error?: string | null;
  /**
   * A gating GET for this page came back 401/403 — render a clear
   * "no permission" state in place of `children` instead of whatever empty
   * form/list state the page would otherwise show (bug-report investigation,
   * prod incident: a swallowed 403 on admin pages was indistinguishable from
   * "nothing exists yet", which is how an admin-only page ended up looking
   * safe to fill in and submit for a caller who never had access). Takes
   * precedence over `children` entirely — the underlying data was never
   * fetched, so there is nothing legitimate to show alongside it.
   */
  permissionDenied?: boolean;
  /** Show the success alert after submit */
  submitted?: boolean;
  /**
   * Max width of the content column. Defaults to 500px (forms).
   * Use 'full' for grids, charts, or drag-and-drop layouts.
   */
  maxWidth?: number | 'full';
  /**
   * 'top'    — content starts at the top (default, suits forms)
   * 'center' — retained for callers; states stay beside the page heading
   */
  align?: 'top' | 'center';
  /** Extra sx on the inner content column */
  contentSx?: SxProps<Theme>;
}

const PageLayout = ({
  children,
  title,
  successMessage,
  showExistingWarning = false,
  warningMessage,
  error,
  permissionDenied = false,
  submitted = false,
  maxWidth = 500,
  align = 'top',
  contentSx,
}: PageLayoutProps) => {
  const contentMaxWidth = maxWidth === 'full' ? '100%' : Math.max(maxWidth, 560);
  const alertMaxWidth = maxWidth === 'full' ? 500 : contentMaxWidth;

  const resolvedWarning =
    warningMessage ?? 'Existing data was found. Submitting will overwrite it.';

  return (
    <Stack
      component="section"
      data-content-align={align}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        bgcolor: 'background.default',
        p: { xs: 2.5, sm: 4, lg: 5 },
        boxSizing: 'border-box',
        maxWidth: 1440,
        mx: 'auto',
        minWidth: 0,
      }}
    >
      <Stack
        spacing={3}
        sx={[
          {
            width: '100%',
            maxWidth: contentMaxWidth,
            alignItems: 'stretch',
          },
          ...(Array.isArray(contentSx) ? contentSx : [contentSx]),
        ]}
      >
        {title && (
          <Typography variant="h1" sx={{ fontSize: { xs: 30, sm: 38 }, mb: 1, textAlign: 'left' }}>
            {title}
          </Typography>
        )}

        {permissionDenied ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 2,
              color: 'text.secondary',
              pt: 4,
            }}
          >
            <LockOutlined fontSize="inherit" sx={{ fontSize: 64 }} />
            <Typography variant="body1" sx={{ textAlign: 'left' }}>
              You don&apos;t have permission to view this page.
            </Typography>
          </Box>
        ) : (
          <>
            {showExistingWarning && (
              <Alert
                severity="warning"
                variant="outlined"
                sx={{ width: '100%', maxWidth: alertMaxWidth }}
              >
                {resolvedWarning}
              </Alert>
            )}

            {submitted && successMessage && (
              <Alert severity="success" sx={{ width: '100%', maxWidth: alertMaxWidth }}>
                {successMessage}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ width: '100%', maxWidth: alertMaxWidth }}>
                {error}
              </Alert>
            )}

            {children}
          </>
        )}
      </Stack>
    </Stack>
  );
};

export default PageLayout;
