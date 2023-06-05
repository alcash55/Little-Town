import { AppBar, IconButton, Typography } from "@mui/material";
import { Menu } from "@mui/icons-material";

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
}

const Bar = ({ openSidebar, setOpenSidebar }: Props) => {
  const toggleSidebar = () => {
    setOpenSidebar(!openSidebar);
  };

  return (
    <AppBar
      sx={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexGrow: 1,
        height: 50,
        px: 4,
      }}
    >
      <IconButton onClick={toggleSidebar}>
        <Menu />
      </IconButton>
      <Typography>Little Town</Typography>
    </AppBar>
  );
};

export default Bar;
