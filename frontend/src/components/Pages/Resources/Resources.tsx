import { Stack, Typography } from '@mui/material'
import { darkTheme } from '../../../layout/Theme/theme';

/**
 * Resource page that shows tips and info for OSRS bossing and others
 */
const Resources = () => {
    return (
        <Stack
            spacing={5}
            justifyContent="center"
            p={2}
            sx={{
                width: '100%',
                height: '100%',
                bgcolor: darkTheme.palette.primary.main,
            }}
        >
            <Typography
                variant="h1"
                sx={{
                    fontSize: 42,
                    textAlign: 'center',
                }}
            >
                Resources
            </Typography>
        </Stack>
    )
}

export default Resources;