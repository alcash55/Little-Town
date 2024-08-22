import {
  Box,
  Button,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useAdminPanel } from './useAdminPanel';
import { BingoSteps } from './BingoSteps';

const AdminPanel = () => {
  const {
    bingoName,
    setBingoName,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    boardSize,
    setBoardSize,
    numberOfTeams,
    setNumberOfTeams,
    teamNames,
    setTeamNames,
    activeStep,
    handleNext,
    handleBack,
    handleSubmit,
  } = useAdminPanel();

  const steps = BingoSteps({
    bingoName,
    setBingoName,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    boardSize,
    setBoardSize,
    numberOfTeams,
    setNumberOfTeams,
    teamNames,
    setTeamNames,
  });

  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      spacing={3}
    >
      <Typography variant="h3" component={'h1'}>
        Admin Panel
      </Typography>

      <Box sx={{ width: '100%', maxWidth: 700 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, idx) => (
            <Step key={idx}>
              <StepLabel icon={step.connector}>{step.title}</StepLabel>
              <StepContent>
                {steps[activeStep].questions.map((question, qIndex) => (
                  <Box key={qIndex} sx={{ mb: 2 }}>
                    <Typography variant="h6">{question.title}</Typography>
                    <Typography>{question.description}</Typography>
                    {question.stepComponent}
                  </Box>
                ))}
                <Box sx={{ mt: 2 }}>
                  {activeStep === steps.length - 1 ? (
                    <Button variant="contained" onClick={handleSubmit}>
                      Create Bingo
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={handleNext}>
                      Next
                    </Button>
                  )}

                  {activeStep === 0 ? (
                    <></>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleBack}
                      disabled={activeStep === 0}
                      sx={{ ml: 2 }}
                    >
                      Back
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    </Stack>
  );
};

export default AdminPanel;
