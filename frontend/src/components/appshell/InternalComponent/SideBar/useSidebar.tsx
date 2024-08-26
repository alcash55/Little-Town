import type { PropsWithChildren } from 'react';
import { createContext, useState, useEffect, useContext, useMemo } from 'react';

export interface SidebarItem {
  title: string;
  href: string;
  icon: string;
  children?: any[];
}

export interface Sidebar {
  icon: string;
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
          icon: 'Home',
        },
        {
          title: 'Admion Panel',
          href: '/AdminPanel',
          icon: 'AdminPanelSettings',
        },
        {
          title: 'Bingo Rules',
          href: '/BingoRules',
          icon: 'Gavel',
        },
        {
          title: 'Bingo Board',
          href: '/BingoBoard',
          icon: 'BoardGame',
        },
        {
          title: 'Team Data',
          href: '/TeamData',
          icon: 'BarChart',
        },

        {
          title: 'Bingo Scores',
          href: '/BingoScores',
          icon: 'EmojiEvents',
        },
        {
          title: 'Discord',
          href: 'https://discord.com/invite/NqzwU3TyUT',
          icon: 'Discord',
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
