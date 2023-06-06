import { Close } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { SidebarItem } from "../../../../contexts";

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
  sidebarItems: SidebarItem[];
}

const Sidebar = ({ openSidebar, setOpenSidebar, sidebarItems }: Props) => {
  const navigate = useNavigate();
  const closeSideBar = () => {
    setOpenSidebar(false);
  };

  const SideBarTopItem = () => {
    return (
      <Box>
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography fontSize={18}>Little Town</Typography>
          <IconButton onClick={closeSideBar}>
            <Close />
          </IconButton>
        </Toolbar>
        <Divider sx={{ color: "white" }} />
      </Box>
    );
  };

  const SideBarItems = () => {
    return (
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 2,
        }}
      >
        {sidebarItems.map((item: SidebarItem) => (
          <Button sx={{ my: 1, width: "100%" }} key={item.title}>
            <Typography onClick={() => navigate(`/${item.href}`)}>
              {item.title}
            </Typography>
          </Button>
        ))}
      </Box>
    );
  };

  return (
    <Drawer
      anchor={"left"}
      open={openSidebar}
      onClose={closeSideBar}
      PaperProps={{ sx: { width: "15%" } }}
    >
      <Box sx={{ width: "100%", px: 2, py: 2 }}>
        <SideBarTopItem />
        <SideBarItems />
      </Box>
    </Drawer>
  );
};

export default Sidebar;
