import { useState } from 'react';
import Close from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HelpOutline from '@mui/icons-material/HelpOutlineOutlined';
import {
  Box,
  Collapse,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import { clan } from '../../../../config/clan';
import { SidebarItem } from './useSidebar';
import { useOnboarding } from '../../../Onboarding';
interface Props {
  loading: boolean;
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
  sidebarItems: SidebarItem[];
  width: string | number;
}
export default function Sidebar({
  loading,
  openSidebar,
  setOpenSidebar,
  sidebarItems,
  width,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const { showIntro, canShowIntro } = useOnboarding();
  const close = () => setOpenSidebar(false);
  const itemSx = {
    borderRadius: 1,
    mb: 0.5,
    '&.active': { color: 'primary.main', bgcolor: 'action.selected' },
    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 36 },
  };
  const link = (item: SidebarItem) =>
    item.href.startsWith('http') ? (
      <ListItemButton
        key={item.href}
        component="a"
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={close}
        sx={itemSx}
      >
        <ListItemIcon>{item.icon}</ListItemIcon>
        <ListItemText primary={item.title} />
      </ListItemButton>
    ) : (
      <ListItemButton
        key={item.href}
        component={NavLink}
        to={item.href}
        end={item.href === '/'}
        onClick={close}
        sx={itemSx}
      >
        <ListItemIcon>{item.icon}</ListItemIcon>
        <ListItemText primary={item.title} />
      </ListItemButton>
    );
  return (
    <Drawer
      id="sidebar"
      anchor="left"
      open={openSidebar}
      onClose={close}
      slotProps={{
        paper: {
          sx: {
            width,
            height: '100dvh',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          },
        },
      }}
    >
      <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
          {clan.name}
        </Typography>
        <IconButton aria-label="Close menu" onClick={close}>
          <Close />
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <CircularProgress aria-label="Loading navigation" />
        ) : (
          <List component="nav" aria-label="Site navigation" disablePadding>
            {sidebarItems.map((item) =>
              item.children ? (
                <Box key={item.href}>
                  <ListItemButton
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    sx={itemSx}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.title} />
                    {expanded ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={expanded}>
                    <List disablePadding sx={{ pl: 2 }}>
                      {item.children.map(link)}
                    </List>
                  </Collapse>
                  <Divider sx={{ my: 1 }} />
                </Box>
              ) : (
                link(item)
              ),
            )}
          </List>
        )}
      </Box>
      {canShowIntro && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
          <ListItemButton
            onClick={() => {
              close();
              showIntro();
            }}
            sx={itemSx}
          >
            <ListItemIcon>
              <HelpOutline />
            </ListItemIcon>
            <ListItemText primary="Show intro" />
          </ListItemButton>
        </Box>
      )}
    </Drawer>
  );
}
