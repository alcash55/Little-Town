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
import { useEffectiveRole } from '../../../../utils/useEffectiveRole';

/** Includes 'public' (logged-out visitor) on top of the three session roles. */
export type SidebarRole = 'public' | 'user' | 'admin' | 'moderator';

export interface SidebarItem {
  title: string;
  href: string;
  icon: ReactNode;
  /**
   * Roles allowed to see this entry, checked against the effective role
   * (utils/useEffectiveRole.ts — session role, or an active impersonation
   * target's role for a real admin). Only set on top-level entries today —
   * children inherit their parent's gating (e.g. every "Admin Panel" child
   * is implicitly admin-only) and are never filtered individually.
   */
  roles?: SidebarRole[];
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

/**
 * Pure filtering decision behind `SidebarProvider` — split out so the
 * role-gating logic is unit-testable without rendering the provider or
 * mocking `useEffectiveRole`. `role` is the value `useEffectiveRole` (or its
 * `?? 'public'` fallback) resolves to; a top-level item is visible only when
 * its own `roles` list includes it. Children never get filtered
 * individually (see the `roles` doc comment on `SidebarItem` above).
 */
export const filterSidebarByRole = (
  items: SidebarItem[],
  role: SidebarRole,
): SidebarItem[] => items.filter((item) => item.roles?.includes(role));

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
        icon: <QueryStats />,
      },
      {
        title: 'Maintenance',
        href: '/AdminPanel/Maintenance',
        icon: <Build />,
      },
      {
        title: 'User Invites',
        href: '/AdminPanel/UserInvite',
        icon: <PersonAddAlt1 />,
      },
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
];

export const SidebarProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [sidebar, setSidebar] = useState<SidebarItem[]>([]);
  // Effective role, not the raw session role (TEAM-BRIEF.md Sprint 10, Track
  // C item 3) — while a real admin is viewing-as a non-admin, this resolves
  // to the impersonated user's role so admin entries disappear exactly as
  // they would for that user, but Clear/the banner (gated on the REAL role
  // elsewhere) keep working since they don't go through this hook.
  const { role: effectiveRole } = useEffectiveRole();

  useEffect(() => {
    setLoading(true);
    // #80: this used to short-circuit to the unfiltered list in local dev
    // (`import.meta.env.DEV`), on the theory that a dev shouldn't need to
    // log in just to see the admin entries. That bypass is what let a
    // logged-out visitor see Admin Panel in the mobile drawer whenever the
    // app ran under `bun run dev` — filtering has to hold in every mode.
    // `backend/supabase/seed.sql` seeds an admin login (admin/password) for
    // local testing instead.
    const roleForFilter: SidebarRole = effectiveRole ?? 'public';
    setSidebar(filterSidebarByRole(allSidebarItems, roleForFilter));
    setLoading(false);
  }, [effectiveRole]);

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
