import { Stack, Tab, Tabs, Typography } from '@mui/material';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { useTeamDrafter } from './useTeamDrafter';
import { DrafterTab } from './DrafterTab';
import { PlayerManagementTab } from './PlayerManagementTab';
import { teamDrafterTabsSx, textSecondary } from './teamDrafterStyles';

export default function TeamDrafter() {
  const hook = useTeamDrafter();

  return (
    <PageLayout title="Team Drafter" maxWidth="full" contentSx={{ alignItems: 'stretch' }}>
      <Tabs
        value={hook.activeTab}
        onChange={(_, v) => hook.setActiveTab(v)}
        sx={teamDrafterTabsSx}
      >
        <Tab label="Drafter" />
        <Tab label="Player Management" />
      </Tabs>

      {hook.activeTab === 0 && (
        <Stack spacing={2} width="100%">
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
          />
        </Stack>
      )}

      {hook.activeTab === 1 && <PlayerManagementTab {...hook} />}
    </PageLayout>
  );
}
