import Home from '@mui/icons-material/Home';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import Gamepad from '@mui/icons-material/Gamepad';
import GroupAdd from '@mui/icons-material/GroupAdd';
import DashboardCustomize from '@mui/icons-material/DashboardCustomize';
import AddAPhoto from '@mui/icons-material/AddAPhoto';
import Gavel from '@mui/icons-material/Gavel';
import BarChart from '@mui/icons-material/BarChart';
import EmojiEvents from '@mui/icons-material/EmojiEvents';
import DriveFileMove from '@mui/icons-material/DriveFileMove';
import QueryStats from '@mui/icons-material/QueryStats';
import Build from '@mui/icons-material/Build';
import PersonAddAlt1 from '@mui/icons-material/PersonAddAlt1';
import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import BoardGame from '../../../../assets/Images/BoardGame';
import Discord from '../../../../assets/Images/Discord';
import { useLoginModal } from '../../../LoginModal/useLoginModal';

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

const allSidebarItems: SidebarItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: <Home />,
    roles: ['public', 'user', 'admin', 'moderator'],
  },
  {
    title: 'Admin Panel',
    href: '/AdminPanel',
    icon: <AdminPanelSettings />,
    roles: ['admin'],
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
      {
        title: 'Bingo Overview',
        href: '/AdminPanel/BingoOverview',
        icon: <QueryStats />
      },
      {
        title: 'Maintenance',
        href: '/AdminPanel/Maintenance',
        icon: <Build />
      },
      {
        title: 'User Invites',
        href: '/AdminPanel/UserInvite',
        icon: <PersonAddAlt1 />
      }
    ],
  },
  {
    title: 'Bingo Rules',
    href: '/BingoRules',
    icon: <Gavel />,
    roles: ['user', 'admin', 'moderator'],
  },
  {
    // Sprint 9, Track B item 3 (TEAM-BRIEF.md): the route itself is public
    // now (see Routes.tsx) — 'public' added here deliberately so a
    // logged-out visitor can actually find the board via navigation, not
    // just a deep link. It's still the only public sidebar entry pointing
    // at gameplay (vs. Home/Resources/Discord above), by design: it's the
    // one page built to make sense un-authed (art + tasks, no highlights,
    // with its own "log in to see your progress" affordance).
    title: 'Bingo Board',
    href: '/BingoBoard',
    icon: <BoardGame />,
    roles: ['public', 'user', 'admin', 'moderator'],
  },
  {
    title: 'Team Data',
    href: '/TeamData',
    icon: <BarChart />,
    roles: ['user', 'admin', 'moderator'],
  },
  {
    title: 'Bingo Scores',
    href: '/BingoScores',
    icon: <EmojiEvents />,
    roles: ['user', 'admin', 'moderator'],
  },
  {
    title: 'Resources',
    href: '/Resources',
    icon: <DriveFileMove />,
    roles: ['public', 'user', 'admin', 'moderator'],

  },
  {
    title: 'Discord',
    href: 'https://discord.com/invite/NqzwU3TyUT',
    icon: <Discord />,
    roles: ['public', 'user', 'admin', 'moderator'],
  },
] as any[];

export const SidebarProvider = ({ children }: PropsWithChildren<{}>) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [sidebar, setSidebar] = useState<SidebarItem[]>([]);
  const { user } = useLoginModal();

  useEffect(() => {
    setLoading(true);
    // In local dev (bun dev), show all sidebar items regardless of role
    if (import.meta.env.DEV) {
      setSidebar(allSidebarItems);
      setLoading(false);
      return;
    }
    const userRole = user?.role ?? 'public';
    const filtered = allSidebarItems.filter((item: any) =>
      item.roles?.includes(userRole),
    );
    setSidebar(filtered);
    setLoading(false);
  }, [user]);

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
