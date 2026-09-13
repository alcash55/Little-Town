import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText('Password').getAttribute('autoComplete')).toBe(
      'current-password',
    );
  });
});
