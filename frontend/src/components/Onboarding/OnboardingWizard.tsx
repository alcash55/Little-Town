import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { appColors } from '../../layout/Theme';
import { useOnboardingProfile } from './useOnboardingProfile';
import { useRsnConfirmation } from './useRsnConfirmation';
import WelcomeStep from './steps/WelcomeStep';
import RsnStep from './steps/RsnStep';
import TeamStep from './steps/TeamStep';
import ResourcesStep from './steps/ResourcesStep';

export type OnboardingStatus = 'completed' | 'skipped';

interface Props {
  open: boolean;
  /**
   * False on a first-time run: Escape/backdrop-close is disabled and the
   * flow must be completed once (TEAM-BRIEF.md Track A #1). True when
   * reopened via "Show intro".
   */
  dismissable: boolean;
  onFinish: (status: OnboardingStatus) => void;
}

const STEP_LABELS = ['Welcome', 'Your RSN', 'Your Team', 'Resources'];
const RSN_STEP_INDEX = 1;

const OnboardingWizard = ({ open, dismissable, onFinish }: Props) => {
  const [activeStep, setActiveStep] = useState(0);
  // Only fetches while the wizard is actually open.
  const profile = useOnboardingProfile(open);
  const rsn = useRsnConfirmation(profile);

  const isLastStep = activeStep === STEP_LABELS.length - 1;
  const nextDisabled = activeStep === RSN_STEP_INDEX && !rsn.confirmed;

  const handleNext = () => {
    if (nextDisabled) return;
    if (isLastStep) {
      onFinish('completed');
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));

  // Clicking a step's "go to X" link mid-wizard closes it the same way
  // dismissing does, except on the last step — following the Resources
  // link there is functionally finishing the tour, not bailing early. On a
  // first-time (non-dismissable) run, an early "go to X" link still
  // navigates (nothing stops the user reading that page), but it no longer
  // closes/persists the wizard — removing "Skip intro" would be cosmetic if
  // this stayed an equivalent escape hatch. The dialog is mounted above the
  // router outlet, so it simply stays open over the new page until the flow
  // is actually finished.
  const handleNavigateAway = () => {
    if (isLastStep) {
      onFinish('completed');
      return;
    }
    if (dismissable) onFinish('skipped');
  };

  // Escape/backdrop click (MUI passes both through this same onClose, with
  // `reason` distinguishing them — irrelevant here since both are blocked
  // the same way). On a first-time run this is a no-op: the flow must be
  // completed once. Reopened via "Show intro", it counts the same as
  // walking away: nothing here is destructive, and it's reachable again any
  // time via "Show intro".
  const handleClose = () => {
    if (dismissable) onFinish('skipped');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableScrollLock
      aria-labelledby="onboarding-wizard-title"
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.7)' } },
        paper: {
          sx: (theme) => ({
            bgcolor: theme.palette.secondary.main,
            border: `1px solid ${theme.palette.primary.main}`,
            color: appColors.textPrimary,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }),
        },
      }}
    >
      <DialogTitle id="onboarding-wizard-title">
        {/* DialogTitle already wraps its children in its own <h2> (an
            internal Typography variant="h6" component="h2"). Nesting a
            second variant="h6" Typography here — which defaults to an
            <h6> element — inside that <h2> is invalid HTML and triggers
            React's validateDOMNesting warning. component="span" keeps the
            h6 look (font size/weight/color from the variant's styles)
            without emitting a second heading element. */}
        <Typography variant="h6" component="span" sx={{ color: appColors.textPrimary }}>
          Welcome to Little Town Bingo
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            mb: 3,
            '& .MuiStepLabel-label': { color: appColors.textSecondary },
            '& .MuiStepLabel-label.Mui-active': { color: appColors.textPrimary },
            '& .MuiStepLabel-label.Mui-completed': { color: appColors.textSecondary },
            '& .MuiStepIcon-root': { color: appColors.subtleBorder },
            '& .MuiStepIcon-root.Mui-active': { color: appColors.accent },
            '& .MuiStepIcon-root.Mui-completed': { color: appColors.accent },
          }}
        >
          {STEP_LABELS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 220 }}>
          {activeStep === 0 && <WelcomeStep />}
          {activeStep === RSN_STEP_INDEX && <RsnStep profile={profile} rsn={rsn} />}
          {activeStep === 2 && <TeamStep profile={profile} onNavigateAway={handleNavigateAway} />}
          {activeStep === 3 && <ResourcesStep onNavigateAway={handleNavigateAway} />}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            sx={{ color: appColors.textSecondary }}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={nextDisabled}
            variant="contained"
            // Computed directly from `nextDisabled` rather than a
            // `&.Mui-disabled` CSS selector — both work, but this reads
            // unambiguously next to the `disabled` prop above without
            // relying on MUI's disabled class landing in sync.
            sx={{
              bgcolor: nextDisabled ? appColors.subtleBorder : appColors.accent,
              color: nextDisabled ? appColors.mutedText : appColors.textPrimary,
              '&:hover': {
                bgcolor: nextDisabled ? appColors.subtleBorder : appColors.accent,
                opacity: nextDisabled ? 1 : 0.85,
              },
            }}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default OnboardingWizard;
