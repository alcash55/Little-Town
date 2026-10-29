import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { resolveClanProfile } from '../../config/clanProfiles';

const config = vi.hoisted(() => ({ id: 'little-town' }));
vi.mock('../../config/clan', () => ({
  get clan() {
    return resolveClanProfile(config.id);
  },
}));
import { LoadingContainer } from './LoadingContainer';

afterEach(cleanup);

describe('clan loading screen', () => {
  it('keeps the Little Town animation on Little Town', () => {
    config.id = 'little-town';
    render(<LoadingContainer loading width={250} height={250} />);
    expect(screen.getByRole('img').getAttribute('src')).toContain('LittleTownAnimation');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading Little Town');
  });

  it('shows Diamond Dogs loading without Little Town artwork', () => {
    config.id = 'diamond-dogs';
    render(<LoadingContainer loading width={250} height={250} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading The Diamond Dogs');
    expect(screen.getByText('The Diamond Dogs')).toBeTruthy();
  });

  it.each(['little-town', 'diamond-dogs'])('escapes a constrained parent for %s loading', (id) => {
    config.id = id;
    const { container } = render(
      <div style={{ height: 160, overflow: 'hidden', transform: 'translateX(40px)' }}>
        <LoadingContainer loading width={250} height={250} />
      </div>,
    );
    expect(container.contains(screen.getByRole('status'))).toBe(false);
    expect(document.body.contains(screen.getByRole('status'))).toBe(true);
  });

  it('shows content after loading instead of either loading screen', () => {
    config.id = 'diamond-dogs';
    render(
      <LoadingContainer loading={false} width={100} height={100}>
        Ready
      </LoadingContainer>,
    );
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
