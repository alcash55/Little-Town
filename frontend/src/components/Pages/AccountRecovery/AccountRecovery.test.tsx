import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountRecovery } from './AccountRecovery';
import { AccountRecoveryAdmin } from '../AdminPanel/UserInvite/AccountRecoveryAdmin';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <AccountRecovery />
    </MemoryRouter>,
  );
const reply = (state: string, status = 200) =>
  new Response(JSON.stringify({ data: { state } }), { status });

describe('account recovery states', () => {
  it('requests a link and shows a confirmation without identifying an account', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    renderPage();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'member@example.test' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send recovery link' }).closest('form')!);
    await screen.findByText(/If an account matches that email/);
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
    expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({ email: 'member@example.test' }));
  });
  for (const [state, message] of [
    ['expired', 'This recovery link has expired.'],
    ['used', 'This recovery link has already been used.'],
    ['invalid', 'This recovery link is invalid or has been replaced.'],
  ]) {
    it(`shows ${state} and offers a new request`, async () => {
      window.history.replaceState(null, '', '/recover#token=fixture');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(state)));
      renderPage();
      await screen.findByText(new RegExp(message));
      expect(window.location.hash).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }));
      expect(screen.getByLabelText(/^Email/)).toBeTruthy();
    });
  }
  it('checks the link without consuming it, validates matching passwords, then resets', async () => {
    window.history.replaceState(null, '', '/recover#token=fixture');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply('ready'))
      .mockResolvedValueOnce(reply('complete'));
    vi.stubGlobal('fetch', fetch);
    renderPage();
    await screen.findByLabelText(/^New password/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/status$/);
    fireEvent.change(screen.getByLabelText(/^New password/), {
      target: { value: 'new secure password' },
    });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
      target: { value: 'does not match' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Set new password' }).closest('form')!);
    expect(await screen.findByText(/Passwords must match/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
      target: { value: 'new secure password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Set new password' }).closest('form')!);
    await screen.findByText(/Your password has changed/);
    expect(fetch.mock.calls[1][0]).toMatch(/\/consume$/);
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
  });
  it('reveals each password independently without submitting or changing its value', async () => {
    window.history.replaceState(null, '', '/recover#token=fixture');
    const fetch = vi.fn().mockResolvedValue(reply('ready'));
    vi.stubGlobal('fetch', fetch);
    renderPage();
    const password = await screen.findByLabelText(/^New password/);
    const confirmation = screen.getByLabelText(/^Confirm new password/);
    fireEvent.change(password, { target: { value: 'visibility test value' } });
    expect(password.getAttribute('type')).toBe('password');
    expect(confirmation.getAttribute('type')).toBe('password');

    password.focus();
    const show = screen.getByRole('button', { name: 'Show new password' });
    fireEvent.mouseDown(show);
    expect(document.activeElement).toBe(password);
    fireEvent.click(show);
    expect(password.getAttribute('type')).toBe('text');
    expect(confirmation.getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Hide new password' }).getAttribute('aria-pressed')).toBe('true');
    expect(password.getAttribute('autoComplete')).toBe('new-password');
    expect(screen.getByDisplayValue('visibility test value')).toBe(password);

    fireEvent.click(screen.getByRole('button', { name: 'Show password confirmation' }));
    expect(confirmation.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide new password' }));
    expect(password.getAttribute('type')).toBe('password');
    expect(confirmation.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password confirmation' }));
    expect(confirmation.getAttribute('type')).toBe('password');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('handles a link consumed by another tab while the password form is open', async () => {
    window.history.replaceState(null, '', '/recover#token=fixture');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(reply('ready')).mockResolvedValueOnce(reply('used', 400)),
    );
    renderPage();
    await screen.findByLabelText(/^New password/);
    for (const label of ['New password', 'Confirm new password'])
      fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
        target: { value: 'new secure password' },
      });
    fireEvent.submit(screen.getByRole('button', { name: 'Set new password' }).closest('form')!);
    await screen.findByText(/This recovery link has already been used/);
  });
  it('shows rate limits and transport errors without a success claim', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    renderPage();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'member@example.test' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send recovery link' }).closest('form')!);
    await screen.findByText(/Too many recovery attempts/);
    expect(screen.queryByText(/If an account matches/)).toBeNull();
  });
  it('checks a link opened in the same tab, including reopening the same link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(reply('expired'))),
    );
    renderPage();
    for (let i = 0; i < 2; i++) {
      act(() => {
        window.history.pushState(null, '', '/recover#token=same-fixture');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      await screen.findByText(/This recovery link has expired/);
      expect(window.location.hash).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }));
    }
  });
  it('requires explicit admin confirmation and dismisses private links', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { url: 'https://example.test/recover#token=fixture' } }),
          ),
        ),
    );
    render(<AccountRecoveryAdmin />);
    const issue = screen.getByRole('button', { name: 'Issue single-use recovery link' });
    expect(issue.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Account username/), { target: { value: 'member' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(issue.hasAttribute('disabled')).toBe(false);
    fireEvent.submit(issue.closest('form')!);
    await screen.findByLabelText('Private recovery link');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss private link' }));
    await waitFor(() => expect(screen.queryByLabelText('Private recovery link')).toBeNull());
  });
});
