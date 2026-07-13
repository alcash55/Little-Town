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
import WelcomeStep from './steps/WelcomeStep';
import RsnStep from './steps/RsnStep';
import TeamStep from './steps/TeamStep';
import ResourcesStep from './steps/ResourcesStep';

export type OnboardingStatus = 'completed' | 'skipped';

interface Props {
  open: boolean;
  onFinish: (status: OnboardingStatus) => void;
}

const STEP_LABELS = ['Welcome', 'Your RSN', 'Your Team', 'Resources'];

const OnboardingWizard = ({ open, onFinish }: Props) => {
  const [activeStep, setActiveStep] = useState(0);
  // Only fetches while the wizard is actually open.
  const profile = useOnboardingProfile(open);

  const isLastStep = activeStep === STEP_LABELS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onFinish('completed');
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));

  const handleSkip = () => onFinish('skipped');

  // Clicking a step's "go to X" link mid-wizard closes it the same way Skip
  // does, except on the last step — following the Resources link there is
  // functionally finishing the tour, not bailing early.
  const handleNavigateAway = () => onFinish(isLastStep ? 'completed' : 'skipped');

  // Any dismissal path (Escape, backdrop click) counts the same as Skip:
  // completion is persisted either way, and it's reachable again via
  // "Show intro" in the sidebar footer.
  const handleClose = () => onFinish('skipped');

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
          {activeStep === 1 && <RsnStep profile={profile} />}
          {activeStep === 2 && <TeamStep profile={profile} onNavigateAway={handleNavigateAway} />}
          {activeStep === 3 && <ResourcesStep onNavigateAway={handleNavigateAway} />}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button onClick={handleSkip} sx={{ color: appColors.mutedText }}>
          Skip intro
        </Button>
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
            variant="contained"
            sx={{
              bgcolor: appColors.accent,
              color: appColors.textPrimary,
              '&:hover': { bgcolor: appColors.accent, opacity: 0.85 },
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
