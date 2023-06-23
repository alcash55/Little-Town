import { Box, Typography } from "@mui/material";
import axios from "axios";

const BingoBoard = () => {
  const getData = async () => {
    try {
      const { data: data } = await axios.get("/api/data");
      return data;
    } catch (e) {
      console.log(e);
      return "unable to get data";
    }
  };

  return (
    <Box>
      <Typography>Bingo Board</Typography>
    </Box>
  );
};

export default BingoBoard;
