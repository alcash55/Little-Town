import { Stack, Typography } from "@mui/material";
import { darkTheme } from "../../../../layout/Theme";

const BingoOverview = () => {
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
                Bingo Overview
            </Typography>
        </Stack>
    )
}

export default BingoOverview;