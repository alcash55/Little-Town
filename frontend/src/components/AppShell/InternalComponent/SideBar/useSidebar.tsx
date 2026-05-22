import Home from '@mui/icons-material/Home';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import Gamepad from '@mui/icons-material/Gamepad';
import GroupAdd from '@mui/icons-material/GroupAdd';
import DashboardCustomize from '@mui/icons-material/DashboardCustomize';
import AddAPhoto from '@mui/icons-material/AddAPhoto';
import Gavel from '@mui/icons-material/Gavel';
import BarChart from '@mui/icons-material/BarChart';
import EmojiEvents from '@mui/icons-material/EmojiEvents';
import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import BoardGame from '../../../../assets/Images/BoardGame';
import Discord from '../../../../assets/Images/Discord';

export interface SidebarItem {
  title: string;
  href: string;
  icon: ReactNode;
  children?: SidebarItem[];
}

export interface Sidebar {
  icon: ReactNode;
  id: number;
  title: string;
  url: string;
}

export type LTSidebarContext = {
  loading: boolean;
  sidebar: SidebarItem[];
};

const initialContext = {
  loading: false,
  sidebar: [],
};

export const SidebarContext = createContext<LTSidebarContext>(initialContext);

export const SidebarProvider = ({ children }: PropsWithChildren<{}>) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [sidebar, setSidebar] = useState<SidebarItem[]>([]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const newSidebar = [
        {
          title: 'Home',
          href: '/',
          icon: <Home />,
        },
        {
          title: 'Admin Panel',
          href: '/AdminPanel',
          icon: <AdminPanelSettings />,
          children: [
            {
              title: 'Bingo Details',
              href: '/AdminPanel/BingoDetails',
              icon: <Gamepad />,
            },
            {
              title: 'Team Drafter',
              href: '/AdminPanel/TeamDrafter',
              icon: <GroupAdd />,
            },
            {
              title: 'Board Builder',
              href: '/AdminPanel/BoardBuilder',
              icon: <DashboardCustomize />,
            },
            {
              title: 'Screenshot Submissions',
              href: '/AdminPanel/ScreenshotSubmission',
              icon: <AddAPhoto />,
            },
          ],
        },
        {
          title: 'Bingo Rules',
          href: '/BingoRules',
          icon: <Gavel />,
        },
        {
          title: 'Bingo Board',
          href: '/BingoBoard',
          icon: <BoardGame />,
        },
        {
          title: 'Team Data',
          href: '/TeamData',
          icon: <BarChart />,
        },

        {
          title: 'Bingo Scores',
          href: '/BingoScores',
          icon: <EmojiEvents />,
        },
        {
          title: 'Discord',
          href: 'https://discord.com/invite/NqzwU3TyUT',
          icon: <Discord />,
        },
        // Sidebaritems can be added here
      ];
      setSidebar(newSidebar);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <SidebarContext.Provider
      value={useMemo(
        () => ({
          loading,
          sidebar,
        }),
        [loading, sidebar],
      )}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const { loading, sidebar } = useContext(SidebarContext);
  return {
    loading,
    sidebar,
  };
};
