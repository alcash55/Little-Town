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
  Box,
} from '@mui/material';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import GamesIcon from '@mui/icons-material/Games';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NumbersIcon from '@mui/icons-material/Numbers';
import BasicInfo from './steps/BasicInfo';
import BingoDates from './steps/BingoDates';
import BoardSize from './steps/BoardSize';
import TeamSize from './steps/TeamSize';
import TeamNames from './steps/TeamNames';

interface BingoBuilderFormProps {
  bingoName: string;
  setBingoName: React.Dispatch<React.SetStateAction<string>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  boardSize: number;
  setBoardSize: React.Dispatch<React.SetStateAction<number>>;
  numberOfTeams: number;
  setNumberOfTeams: React.Dispatch<React.SetStateAction<number>>;
  teamNames: string[];
  setTeamNames: React.Dispatch<React.SetStateAction<string[]>>;
  activeStep: number;
  handleFormNext: () => void;
  handleFormBack: () => void;
  handleSubmit: () => Promise<void>;
}

export const BingoBuilderForm = (props: BingoBuilderFormProps) => {
  const theme = useTheme();
  const largeMobile = useMediaQuery(theme.breakpoints.down(425));

  const steps = [
    {
      title: 'Bingo Name',
      question: 'What is the name of the bingo?',
      connector: <DriveFileRenameOutlineIcon />,
      component: <BasicInfo bingoName={props.bingoName} setBingoName={props.setBingoName} />,
      validation: props.bingoName !== '',
    },
    {
      title: 'Bingo Dates',
      question: 'When will the bingo start and end?',
      connector: <CalendarTodayIcon />,
      component: (
        <BingoDates
          startDate={props.startDate}
          setStartDate={props.setStartDate}
          endDate={props.endDate}
          setEndDate={props.setEndDate}
        />
      ),
      validation: props.startDate !== '' && props.endDate !== '',
    },
    {
      title: 'Board Size',
      question: 'What size bingo board will you be using?',
      connector: <GamesIcon />,
      component: <BoardSize boardSize={props.boardSize} setBoardSize={props.setBoardSize} />,
      validation: props.boardSize === 16 || props.boardSize === 35,
    },
    {
      title: 'Number of Teams',
      question: 'How many teams will be playing?',
      connector: <NumbersIcon />,
      component: (
        <TeamSize
          numberOfTeams={props.numberOfTeams}
          setNumberOfTeams={props.setNumberOfTeams}
          teamNames={props.teamNames}
          setTeamNames={props.setTeamNames}
        />
      ),
      validation: props.numberOfTeams >= 2,
    },
    {
      title: 'Team Names',
      question: 'Fill in each team name',
      connector: <PeopleIcon />,
      component: <TeamNames teamNames={props.teamNames} setTeamNames={props.setTeamNames} />,
      validation: props.teamNames.every((name) => name !== ''),
    },
  ];

  return (
    <Stepper activeStep={props.activeStep} orientation="vertical">
      {steps.map((step, idx) => (
        <Step key={idx}>
          <StepLabel icon={step.connector} sx={{ height: largeMobile ? 12 : 24 }}>
            {step.title}
          </StepLabel>

          <StepContent>
            <Stack spacing={2}>
              <Typography>{step.question}</Typography>
              <Box>{step.component}</Box>
            </Stack>

            <Stack spacing={1} direction={'row'} justifyContent={'space-evenly'} p={1}>
              {props.activeStep === steps.length - 1 ? (
                <Button
                  disabled={!step.validation}
                  variant={'outlined'}
                  onClick={() => props.handleSubmit()}
                >
                  Create Bingo
                </Button>
              ) : (
                <Button
                  variant={step.validation ? 'contained' : 'outlined'}
                  onClick={() => props.handleFormNext()}
                >
                  Next
                </Button>
              )}

              {props.activeStep !== 0 && (
                <Button variant="contained" onClick={() => props.handleFormBack} sx={{ ml: 2 }}>
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
