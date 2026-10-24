import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useImpersonationTarget } from './useImpersonationTarget';
import { getImpersonationTarget, setImpersonationTarget } from '../../../../utils/impersonation';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

function setup(pathname: string, from?: string) {
  setImpersonationTarget({ id: 'target-48', label: 'Fixture user', role: 'user' });
  return renderHook(() => useImpersonationTarget(), {
    wrapper: ({ children }) => (
      <MemoryRouter
        initialEntries={[
          {
            pathname,
            state: from ? { from: { pathname: from }, reason: 'forbidden' } : null,
          },
        ]}
      >
        {children}
      </MemoryRouter>
    ),
  });
}

describe('clearing impersonation', () => {
  it('reloads the denied destination directly instead of racing history replacement', () => {
    const replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {});
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const { result } = setup('/unauthorized', '/AdminPanel/UserInvite');
    act(() => result.current.clear());
    expect(getImpersonationTarget()).toBeNull();
    expect(replace).toHaveBeenCalledWith('/AdminPanel/UserInvite');
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([undefined, '//external.example', 'https://external.example'])(
    'reloads in place without a local return path: %s',
    (from) => {
      const replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {});
      const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      const { result } = setup('/unauthorized', from);
      act(() => result.current.clear());
      expect(reload).toHaveBeenCalledOnce();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it('keeps the current page when clearing outside the denial screen', () => {
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const { result } = setup('/Resources', '/AdminPanel/UserInvite');
    act(() => result.current.clear());
    expect(reload).toHaveBeenCalledOnce();
  });
});
