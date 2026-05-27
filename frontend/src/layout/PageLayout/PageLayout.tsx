import { Alert, Stack, SxProps, Theme, Typography, useTheme } from '@mui/material';
import { darkTheme } from '../Theme/theme';
import { ReactNode } from 'react';
import { BingoUpdated } from '../../components/BingoUpdated/BingoUpdated';

const DEFAULT_TOOLBAR_OFFSET = '64px';

/** Pages render below the AppShell toolbar — 100vh overflows by this amount. */
const getViewportHeightBelowAppBar = (toolbarMinHeight: unknown) => {
    let offset = DEFAULT_TOOLBAR_OFFSET;

    if (typeof toolbarMinHeight === 'number') {
        offset = `${toolbarMinHeight}px`;
    } else if (typeof toolbarMinHeight === 'string') {
        offset = toolbarMinHeight;
    }

    return `calc(100dvh - ${offset})`;
};

interface PageLayoutProps {
    children?: ReactNode;
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
}

const PageLayout = ({
    children,
    title,
    bingoItem,
    showExistingWarning = false,
    warningMessage,
    error,
    submitted = false,
    isUpdated = false,
    maxWidth = 500,
    align = 'top',
    contentSx,
}: PageLayoutProps) => {
    const theme = useTheme();
    const viewportHeight = getViewportHeightBelowAppBar(theme.mixins.toolbar.minHeight);
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
            justifyContent={align === 'center' ? 'center' : 'flex-start'}
            alignItems="center"
            sx={{
                bgcolor: darkTheme.palette.primary.main,
                p: { xs: 3, sm: 5 },
                boxSizing: 'border-box',
                overflowX: 'hidden',
                overflowY: 'auto',
                height: viewportHeight,
                maxHeight: viewportHeight,
                minHeight: viewportHeight,
            }}
        >
            {submitted && bingoItem ? (
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
