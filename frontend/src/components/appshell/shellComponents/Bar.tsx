import { AppBar, IconButton, Typography, Box } from "@mui/material";
import { Menu } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
}

const Bar = ({ openSidebar, setOpenSidebar }: Props) => {
  const toggleSidebar = () => {
    setOpenSidebar(!openSidebar);
  };

  const navigate = useNavigate();

  return (
    <AppBar
      sx={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexGrow: 1,
        height: "50px",
        px: 4,
      }}
    >
      <IconButton onClick={toggleSidebar}>
        <Menu />
      </IconButton>

      <Box
        onClick={() => navigate("/")}
        sx={{ "&hover": { cursor: "pointer" } }}
      >
        <Typography>Little Town</Typography>
      </Box>
    </AppBar>
  );
};

export default Bar;
