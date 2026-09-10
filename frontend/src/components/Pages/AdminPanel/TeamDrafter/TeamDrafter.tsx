import { Badge, Stack, Tab, Tabs, Typography } from '@mui/material';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { useTeamDrafter } from './useTeamDrafter';
import { DrafterTab } from './DrafterTab';
import { PlayerManagementTab } from './PlayerManagementTab';
import { RsnClaimsTab } from './RsnClaimsTab';
import { teamDrafterTabsSx, textSecondary } from './teamDrafterStyles';

export default function TeamDrafter() {
  const hook = useTeamDrafter();

  return (
    <PageLayout
      title="Team Drafter"
      maxWidth="full"
      contentSx={{ alignItems: 'stretch' }}
      permissionDenied={hook.permissionDenied}
    >
      <Tabs value={hook.activeTab} onChange={(_, v) => hook.setActiveTab(v)} sx={teamDrafterTabsSx}>
        <Tab label="Drafter" />
        <Tab label="Player Management" />
        <Tab
          label={
            <Badge
              color="warning"
              badgeContent={hook.unclaimedPlayers.length}
              sx={{ '& .MuiBadge-badge': { right: -12, top: -2 } }}
            >
              RSN Claims
            </Badge>
          }
        />
      </Tabs>
      {hook.activeTab === 0 && (
        <Stack
          spacing={2}
          sx={{
            width: '100%',
          }}
        >
          <Typography variant="body1" sx={{ color: textSecondary, fontSize: 14 }}>
            Drag players from the pool into a team. Once the pool is empty you can submit to save
            assignments.
          </Typography>
          <DrafterTab
            teams={hook.teams}
            draftItems={hook.draftItems}
            setDraftItems={hook.setDraftItems}
            anyTeamHasPlayers={hook.anyTeamHasPlayers}
            poolIsEmpty={hook.poolIsEmpty}
            showSubmitButton={hook.poolIsEmpty || hook.teamsEverSubmitted}
            submitTeamsDisabled={hook.submitTeamsDisabled}
            submitTeamsLabel={hook.submitTeamsLabel}
            submitting={hook.submitting}
            submitError={hook.submitError}
            submitSuccess={hook.submitSuccess}
            submitDraft={hook.submitDraft}
            resetDraft={hook.resetDraft}
            loadingBingo={hook.loadingBingo}
            bingoError={hook.bingoError}
            unclaimedRsnSet={hook.unclaimedRsnSet}
          />
        </Stack>
      )}
      {hook.activeTab === 1 && <PlayerManagementTab {...hook} />}
      {hook.activeTab === 2 && <RsnClaimsTab {...hook} />}
    </PageLayout>
  );
}
