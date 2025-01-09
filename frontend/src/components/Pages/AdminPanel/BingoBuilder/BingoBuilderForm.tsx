import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Stack,
  Typography,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { BingoSteps } from './BingoSteps';
import { Dispatch } from 'react';

interface BingoBuilderFormProps {
  bingoName: string;
  setBingoName: Dispatch<React.SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<React.SetStateAction<string>>;
  boardSize: number;
  setBoardSize: Dispatch<React.SetStateAction<number>>;
  numberOfTeams: number;
  setNumberOfTeams: Dispatch<React.SetStateAction<number>>;
  teamNames: string[];
  setTeamNames: Dispatch<React.SetStateAction<string[]>>;
  activeStep: number;
  handleFormNext: () => void;
  handleFormBack: () => void;
  handleSubmit: () => Promise<void>;
  validateForm: () => boolean;
}

export const BingoBuilderForm = (props: BingoBuilderFormProps) => {
  const theme = useTheme();
  const largeMobile = useMediaQuery(theme.breakpoints.down(425));
  const steps = BingoSteps(props);
  const isValidated =
    props.bingoName !== '' &&
    props.startDate &&
    props.endDate &&
    (props.boardSize == 16 || props.boardSize == 35) &&
    props.numberOfTeams >= 2 &&
    props.teamNames
      ? true
      : false;
  return (
    <Stepper activeStep={props.activeStep} orientation="vertical">
      {steps.map((step, idx) => (
        <Step key={idx}>
          <StepLabel icon={step.connector} sx={{ height: largeMobile ? 12 : 24 }}>
            {step.title}
          </StepLabel>
          <StepContent>
            {steps[props.activeStep].questions.map((question, qIndex) => (
              <Stack key={qIndex} spacing={1} p={1}>
                <Typography variant="h6">{question.title}</Typography>
                <Typography>{question.description}</Typography>
                {question.stepComponent}
              </Stack>
            ))}

            <Stack spacing={1} direction={'row'} justifyContent={'space-evenly'} p={1}>
              {props.activeStep === steps.length - 1 ? (
                <Button variant="contained" onClick={props.handleSubmit} disabled={!isValidated}>
                  Create Bingo
                </Button>
              ) : (
                <Button variant="contained" onClick={props.handleFormNext}>
                  Next
                </Button>
              )}

              {props.activeStep === 0 ? (
                <></>
              ) : (
                <Button
                  variant="outlined"
                  onClick={props.handleFormBack}
                  disabled={props.activeStep === 0}
                  sx={{
                    color: 'white',
                    borderColor: 'white',
                    ml: 2,
                  }}
                >
                  Back
                </Button>
              )}
            </Stack>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  );
};
