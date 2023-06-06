import { useEffect, useState } from "react";
import { Close, Casino, Home, Looks } from "@mui/icons-material";
import Discord from "../../../../assets/Images/Discord";
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
        {sidebarItems.map((item: SidebarItem) => {
          let IconComponent;

          switch (item.icon) {
            case "Casino":
              IconComponent = Casino;
              break;
            case "Home":
              IconComponent = Home;
              break;
            case "Discord":
              IconComponent = Discord;
              break;
            default:
              IconComponent = Casino; // Set a default icon component
          }
          return (
            <Button
              startIcon={<IconComponent />} // Render the icon component
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
              <Typography>{item.title}</Typography>
            </Button>
          );
        })}
      </Box>
    );
  };

  // function getIcons(iconName: string) {
  //   let result;
  //   const expr: string = iconName;
  //   switch (expr) {
  //     case "Casino":
  //       result = Casino;
  //       break;
  //     case "Home":
  //       result = Home;
  //       break;
  //     case "Discord":
  //       result = discord;
  //       break;
  //     default:
  //       result = Looks;
  //   }
  //   return result;
  // }

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
