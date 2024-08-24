import {
  Box,
  Button,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
} from '@mui/material';
import { useAdminPanel } from './useAdminPanel';
import { BingoBuilderForm } from './BingoBuilderForm';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const CustomTabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

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
    handleFormNext,
    handleFormBack,
    handleSubmit,
    validateForm,
    tab,
    setActiveTab,
  } = useAdminPanel();

  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      spacing={3}
    >
      <Stack spacing={2} alignItems={'center'} width={'100%'} height={'100%'}>
        <Tabs
          value={tab}
          onChange={setActiveTab}
          aria-label=""
          variant="fullWidth"
          sx={{
            width: '100%',
            bgcolor: 'black',
            opacity: 0.5,
            '& .MuiTab-root': {
              color: 'grey', // Text color for tabs
              '&.Mui-selected': {
                color: '#2A9D8F', // Text color for selected tab
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#2A9D8F', // Indicator color
            },
          }}
        >
          <Tab label="Bingo Overview" value={1} {...a11yProps(0)} />
          <Tab label="Screenshot Submissions" value={2} {...a11yProps(1)} />
          <Tab label="Bingo Builder" value={3} {...a11yProps(2)} />
          <Tab label="Team Drafter" value={4} {...a11yProps(3)} />
        </Tabs>
        <Typography variant="h3" component={'h1'} textAlign={'center'}>
          Admin Panel
        </Typography>

        <Box sx={{ width: '100%', height: '100%' }}>
          <CustomTabPanel index={1} value={tab}>
            Bingo Overview
          </CustomTabPanel>
          <CustomTabPanel index={2} value={tab}>
            Screenshot Submissions
          </CustomTabPanel>
          <CustomTabPanel index={3} value={tab}>
            <BingoBuilderForm
              activeStep={activeStep}
              bingoName={bingoName}
              setBingoName={setBingoName}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              boardSize={boardSize}
              setBoardSize={setBoardSize}
              numberOfTeams={numberOfTeams}
              setNumberOfTeams={setNumberOfTeams}
              teamNames={teamNames}
              setTeamNames={setTeamNames}
              handleFormNext={handleFormNext}
              handleFormBack={handleFormBack}
              handleSubmit={handleSubmit}
              validateForm={validateForm}
            />
          </CustomTabPanel>
          <CustomTabPanel index={4} value={tab}>
            Team Drafter
          </CustomTabPanel>
        </Box>
      </Stack>
    </Stack>
  );
};

export default AdminPanel;
