import { CheckCircleOutline } from '@mui/icons-material'
import { Button, Stack, Typography, } from '@mui/material'
import { darkTheme } from '../../layout/Theme'

interface BingoUpdatedProps {
    isBingo: boolean;
    itemUpdated: string;
}

export const BingoUpdated = ({ isBingo, itemUpdated }: BingoUpdatedProps) => {
    return (
        <Stack spacing={3} alignItems="center" sx={{ flex: 1 }}>
            <CheckCircleOutline sx={{ fontSize: 80, color: 'success.main' }} />
            <Typography variant="h2" sx={{ fontSize: 28, textAlign: 'center', color: 'success.main' }}>
                {isBingo ? 'Bingo Updated!' : 'Bingo Created!'}
            </Typography>
            <Typography variant="body1" sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}>
                {isBingo ? `${itemUpdated} has been updated successfully.` : `${itemUpdated} has been created successfully.`}
            </Typography>
            <Button variant="outlined" color="success" onClick={() => window.location.reload()}>
                Make Changes
            </Button>
        </Stack>
    )
}