import { Stack, Typography, Box } from "@mui/material";
import { darkTheme } from "../../../layout/Theme";


const TeamProgress = () => {

// Import Theme
// set page layout
// create section for google sheet boxes


  return (
    <Stack spacing={5}
      justifyContent="center"
      p={2}
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: darkTheme.palette.primary.main,
      }}>
      <Typography variant="h1"
        sx={{
          fontSize: 42,
          textAlign: "center",
        }}>Team Progress</Typography>
        <Box sx={{display: 'flex', width: '75%', height: '75%', flexDirection: 'row'}}>
          <Box sx={{bg: 'red', width: '25%', height: '25%'}}>1</Box>
          <Box sx={{bg: 'orange', width: '25%'}}>2</Box>
          <Box sx={{bg: 'orange', width: '25%'}}>3</Box>
          <Box sx={{bg: 'orange', width: '25%'}}>4</Box>
          <Box sx={{bg: 'orange', width: '25%'}}>5</Box>
          <Box sx={{bg: 'orange', width: '25%'}}>6</Box>
        </Box>

    </Stack>
  
  );
};

export default TeamProgress;
