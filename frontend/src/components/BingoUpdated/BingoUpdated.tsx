import { CheckCircleOutline } from '@mui/icons-material'
import { Button, Stack, Typography, } from '@mui/material'
import { darkTheme } from '../../layout/Theme'

interface BingoUpdatedProps {
    /** Was it a POST or a PUT */
    isUpdated: boolean;
    itemUpdated: string;
}

export const BingoUpdated = ({ isUpdated, itemUpdated }: BingoUpdatedProps) => {
    return (
        <Stack spacing={3} alignItems="center" sx={{ flex: 1 }}>
            <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main' }} />
            <Typography variant="h2" sx={{ fontSize: 28, textAlign: 'center', color: 'success.main' }}>
                {isUpdated ? `${itemUpdated} Updated!` : `${itemUpdated} Created!`}
            </Typography>
            <Typography variant="body1" sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}>
                {isUpdated ? `${itemUpdated} has been updated successfully.` : `${itemUpdated} has been created successfully.`}
            </Typography>
            <Button variant="outlined" color="success" onClick={() => window.location.reload()}>
                Make Changes
            </Button>
        </Stack>
    )
}