import { Suspense, lazy } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Routes as appRouter } from './Routes';
import { clan } from '../../config/clan';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function rootRoute() {
  const root = appRouter.routes.find((route) => route.path === '/');
  if (!root || root.index === true) throw new Error('Expected the application root route');
  return root;
}
it('handles a rejected lazy module on recovery without developer text or error details', async () => {
  const MissingModule = lazy(() =>
    Promise.reject(
      new TypeError(
        'error loading dynamically imported module: https://example.test/assets/LoginModal-old.js',
      ),
    ),
  );
  const router = createMemoryRouter(
    [
      {
        ...rootRoute(),
        children: [
          {
            path: 'recover',
            element: (
              <Suspense fallback="Loading">
                <MissingModule />
              </Suspense>
            ),
          },
        ],
      },
    ],
    { initialEntries: ['/recover'] },
  );
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: "This page couldn't load" })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh page' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
  expect(screen.getByText(/original reset link/)).toBeTruthy();
  expect(document.body.textContent).not.toContain('Hey developer');
  expect(document.body.textContent).not.toContain('LoginModal-old.js');
});
it('renders the fallback even when the normal providers fail', async () => {
  function Crash(): never {
    throw new Error('private diagnostic fixture');
  }
  const router = createMemoryRouter([{ ...rootRoute(), element: <Crash />, children: undefined }]);
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: "This page couldn't load" })).toBeTruthy();
  expect(screen.getByText(clan.name)).toBeTruthy();
  expect(document.body.textContent).not.toContain('private diagnostic fixture');
});
it('handles a router 404 with the missing-page screen', async () => {
  const router = createMemoryRouter([
    {
      ...rootRoute(),
      children: [
        {
          index: true,
          loader: () => {
            throw new Response(null, { status: 404 });
          },
        },
      ],
    },
  ]);
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Refresh page' })).toBeNull();
});
it('uses the friendly 404 for an unknown application URL', async () => {
  const router = createMemoryRouter(appRouter.routes, {
    initialEntries: ['/missing-page-fixture'],
  });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
});
