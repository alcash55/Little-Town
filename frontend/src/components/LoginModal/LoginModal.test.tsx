import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LoginModal from './LoginModal';

// #81, WCAG 2.2 AA 1.3.5 (Identify Input Purpose): a password manager can
// only offer the saved credential for these fields when autoComplete
// declares their purpose. DevTools flagged the missing attributes during
// the Sprint 18 accessibility pass.
describe('LoginModal — input purpose (#81)', () => {
  afterEach(cleanup);

  it('declares autoComplete="username" on the identifier field', () => {
    render(<LoginModal open onClose={() => {}} />);
    expect(screen.getByLabelText('Username').getAttribute('autoComplete')).toBe('username');
  });

  it('declares autoComplete="current-password" on the password field, not new-password', () => {
    render(<LoginModal open onClose={() => {}} />);
    expect(screen.getByLabelText('Password').getAttribute('autoComplete')).toBe('current-password');
  });
  it('reveals and hides the password without submitting or replacing the value', () => {
    let submissions = 0;
    render(<LoginModal open onClose={() => {}} onSubmit={() => { submissions++; }} />);
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'visibility test value' } });
    expect(password.getAttribute('type')).toBe('password');
    password.focus();
    const show = screen.getByRole('button', { name: 'Show password' });
    fireEvent.mouseDown(show);
    expect(document.activeElement).toBe(password);
    fireEvent.click(show);
    expect(password.getAttribute('type')).toBe('text');
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide.getAttribute('type')).toBe('button');
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByDisplayValue('visibility test value')).toBe(password);
    fireEvent.click(hide);
    expect(password.getAttribute('type')).toBe('password');
    expect(submissions).toBe(0);
  });

});
