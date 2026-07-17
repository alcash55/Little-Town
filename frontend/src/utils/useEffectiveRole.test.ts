import { describe, expect, it } from 'vitest';
import { computeEffectiveRole } from './useEffectiveRole';
import { ImpersonationTarget } from './impersonation';

const target = (role: ImpersonationTarget['role']): ImpersonationTarget => ({
  id: 'target-1',
  label: 'Target User',
  role,
});

describe('computeEffectiveRole — role-gating decision logic (bug-report investigation, prod incident)', () => {
  it('returns null role for a logged-out visitor', () => {
    expect(computeEffectiveRole(null, null)).toEqual({ role: null, isImpersonating: false });
    expect(computeEffectiveRole(undefined, null)).toEqual({ role: null, isImpersonating: false });
  });

  it('returns the session role as-is for a plain user with no impersonation target', () => {
    expect(computeEffectiveRole({ role: 'user' }, null)).toEqual({
      role: 'user',
      isImpersonating: false,
    });
  });

  it('returns the session role as-is for a moderator with no impersonation target', () => {
    expect(computeEffectiveRole({ role: 'moderator' }, null)).toEqual({
      role: 'moderator',
      isImpersonating: false,
    });
  });

  it('returns admin as-is when a real admin has no active impersonation target', () => {
    expect(computeEffectiveRole({ role: 'admin' }, null)).toEqual({
      role: 'admin',
      isImpersonating: false,
    });
  });

  it("applies the target's role when a real admin is impersonating a user", () => {
    expect(computeEffectiveRole({ role: 'admin' }, target('user'))).toEqual({
      role: 'user',
      isImpersonating: true,
    });
  });

  it("applies the target's role when a real admin is impersonating a moderator", () => {
    expect(computeEffectiveRole({ role: 'admin' }, target('moderator'))).toEqual({
      role: 'moderator',
      isImpersonating: true,
    });
  });

  // Core regression coverage for the prod incident: a plain user must never
  // be granted admin (or any other elevated) access via a leftover
  // impersonation target — whether that target is stale sessionStorage from
  // a previous admin session in the same tab, or freshly present the instant
  // after a cross-tab account switch, before ImpersonationBannerHost's own
  // cleanup effect (or useLoginModal's `storage` listener) has run.
  it('ignores an impersonation target entirely when the real session is a plain user (stale-target shape)', () => {
    expect(computeEffectiveRole({ role: 'user' }, target('user'))).toEqual({
      role: 'user',
      isImpersonating: false,
    });
  });

  it('ignores an impersonation target entirely when the real session is a moderator (stale-target shape)', () => {
    expect(computeEffectiveRole({ role: 'moderator' }, target('moderator'))).toEqual({
      role: 'moderator',
      isImpersonating: false,
    });
  });

  it('ignores a leftover impersonation target when nobody is logged in (post-logout stale-target shape)', () => {
    expect(computeEffectiveRole(null, target('admin'))).toEqual({
      role: null,
      isImpersonating: false,
    });
  });
});
