import { useEffect, useState } from "react";
import { Close } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  SvgIcon,
} from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { SidebarItem } from "../../../../contexts";
import "@fontsource/pacifico";

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
  sidebarItems: SidebarItem[];
  width: string | number;
}

const Sidebar = ({
  openSidebar,
  setOpenSidebar,
  sidebarItems,
  width,
}: Props) => {
  const navigate = useNavigate();
  const [drawerWidth, setDrawerWidth] = useState(width);
  const closeSideBar = () => {
    setOpenSidebar(false);
  };

  useEffect(() => {
    setDrawerWidth(width);
  }, [window.innerWidth]);

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
          <Typography fontFamily={"'pacifico', cursive"} fontSize={18}>
            Little Town
          </Typography>
          <IconButton onClick={closeSideBar}>
            <Close />
          </IconButton>
        </Toolbar>
        <Divider sx={{ color: "white" }} />
      </Box>
    );
  };

  const SideBarItems = () => {
    // const navigation = async (href: string) => {
    //   if (href.includes("discord")) {
    //     let link = href.slice(1);
    //     console.log(link);
    //   } else {
    //     await navigate(href);
    //   }
    // };

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
          <Button
            component={Link}
            to={`${item.href}`}
            target={item.href.includes("discord") ? "_blank" : ""}
            color="inherit"
            sx={{
              my: 1,
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
            key={item.title}
          >
            <SvgIcon>{item.icon}</SvgIcon>
            <Typography>{item.title}</Typography>
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
      PaperProps={{ sx: { width: drawerWidth, overflowX: "hidden" } }}
    >
      <Box sx={{ width: "100%", px: 2, py: 2 }}>
        <SideBarTopItem />
        <SideBarItems />
      </Box>
    </Drawer>
  );
};

export default Sidebar;