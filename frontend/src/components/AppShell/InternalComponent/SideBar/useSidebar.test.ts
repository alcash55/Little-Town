import { describe, expect, it } from 'vitest';
import { filterSidebarByRole, type SidebarItem } from './useSidebar';

const items: SidebarItem[] = [
  { title: 'Home', href: '/', icon: null, roles: ['public', 'user', 'admin', 'moderator'] },
  { title: 'Admin Panel', href: '/AdminPanel', icon: null, roles: ['admin'] },
  { title: 'Bingo Rules', href: '/BingoRules', icon: null, roles: ['user', 'admin', 'moderator'] },
];

describe('filterSidebarByRole (#80, mobile drawer showed Admin Panel to logged-out visitors)', () => {
  // The failing direction nobody writes a test for, per the issue: a
  // logged-out visitor must never see an admin-only entry, in the mobile
  // drawer or the desktop sidebar (both read from this same filtered list).
  it('hides Admin Panel from a logged-out visitor (public role)', () => {
    const visible = filterSidebarByRole(items, 'public');
    expect(visible.map((i) => i.title)).toEqual(['Home']);
  });

  it('hides Admin Panel from a plain user', () => {
    const visible = filterSidebarByRole(items, 'user');
    expect(visible.map((i) => i.title)).toEqual(['Home', 'Bingo Rules']);
  });

  it('hides Admin Panel from a moderator', () => {
    const visible = filterSidebarByRole(items, 'moderator');
    expect(visible.map((i) => i.title)).toEqual(['Home', 'Bingo Rules']);
  });

  it('shows Admin Panel to an admin', () => {
    const visible = filterSidebarByRole(items, 'admin');
    expect(visible.map((i) => i.title)).toEqual(['Home', 'Admin Panel', 'Bingo Rules']);
  });

  it('excludes an item with no roles declared at all (fail closed, not fail open)', () => {
    const withUngated: SidebarItem[] = [...items, { title: 'Untyped', href: '/x', icon: null }];
    expect(filterSidebarByRole(withUngated, 'admin').map((i) => i.title)).not.toContain('Untyped');
  });
});
