import { Stack, Typography } from '@mui/material';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../../layout/Theme';
import { useUserInvite } from './useUserInvite';
import InviteGenerator from './InviteGenerator';
import InviteList from './InviteList';

/**
 * /AdminPanel/UserInvite — generate, list, copy, and revoke single-use
 * onboarding invite links. Consumes the frozen contract in TEAM-BRIEF.md
 * (Track A #1) via useUserInvite.ts; see that file for the exact shapes.
 *
 * This component was a bare `<PageLayout>` stub with no logic before this
 * change (see git history) — rebuilt from scratch on top of it rather than
 * reusing anything, since there was nothing to reuse.
 */
const UserInvite = () => {
  const invite = useUserInvite();

  return (
    <PageLayout title="User Invites" maxWidth="full">
      <Typography variant="body2" sx={{ color: appColors.textSecondary, textAlign: 'center' }}>
        Generate single-use links to onboard new members, and manage existing ones.
      </Typography>

      <Stack spacing={4} sx={{ width: '100%', maxWidth: 760, alignItems: 'stretch' }}>
        <InviteGenerator
          generating={invite.generating}
          generateError={invite.generateError}
          justCreated={invite.justCreated}
          onGenerate={invite.generateInvite}
          onDismissCreated={invite.dismissJustCreated}
          onDismissGenerateError={invite.dismissGenerateError}
        />
        <InviteList
          invites={invite.invites}
          loading={invite.loading}
          error={invite.error}
          revokingId={invite.revokingId}
          revokeError={invite.revokeError}
          onRevoke={invite.revokeInvite}
          onRefresh={invite.refresh}
        />
      </Stack>
    </PageLayout>
  );
};

export default UserInvite;
