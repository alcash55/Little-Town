import { AppBar, IconButton, Typography, Box } from "@mui/material";
import "@fontsource/pacifico";
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
        pr: 4,
        pl: 3,
      }}
    >
      <IconButton onClick={toggleSidebar}>
        <Menu />
      </IconButton>

      <Box>
        <Typography
          onClick={() => navigate("/")}
          component={"div"}
          sx={{
            "&:hover": { cursor: "pointer" },
            width: "100px",
            height: "44px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "'pacifico', cursive",
          }}
          noWrap
          fontSize={18}
        >
          Little Town
        </Typography>
      </Box>
    </AppBar>
  );
};

export default Bar;
