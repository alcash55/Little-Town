import { Alert, Stack, Typography } from '@mui/material'
import { darkTheme } from '../Theme/theme';
import { ReactNode } from 'react';
import { BingoUpdated } from '../../components/BingoUpdated/BingoUpdated';

interface PageLayoutProps {
    children: ReactNode;
    /** Page header */
    title: string;
    /** What about the bingo was added or changed */
    bingoItem: string;
    /** If there are API requests show errors */
    error?: string
    /** Way to track if data was submitted */
    submitted?: boolean
    /** Was it a POST or a PUT */
    isUpdated: boolean
}

/**
 * Page layout
 * Includes themes, responsiveness, warnings/errors, and the submitted component
 */
const PageLayout = ({ children, title, bingoItem, error, submitted, isUpdated }: PageLayoutProps) => {
    return (
        <Stack
            spacing={3} width="100%" justifyContent="flex-start" alignItems="center"
            sx={{
                bgcolor: darkTheme.palette.primary.main, p: 5, minHeight: '100vh',
                boxSizing: 'border-box',
                overflow: 'scroll',
            }}
        >
            <Typography
                variant="h1"
                sx={{
                    fontSize: 42,
                    textAlign: 'center',
                }}
            >
                {title}
            </Typography>

            {submitted ? (
                <BingoUpdated isUpdated={isUpdated} itemUpdated={bingoItem} />
            ) : (
                <>
                    {bingoItem && (
                        <Alert severity="warning" sx={{ width: '100%', maxWidth: 500 }}>
                            {bingoItem} details already exist, any changes made will modify the already existing {bingoItem}
                        </Alert>
                    )}

                    {error && (
                        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>{error}</Alert>
                    )}

                    {children}
                </>

            )}


        </Stack>
    )
}

export default PageLayout