import { Box, Stack, Typography, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import GamepadIcon from '@mui/icons-material/Gamepad';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useAdminPanel } from './useAdminPanel';
import { BingoBuilderForm } from './BingoBuilder/BingoBuilderForm';
import BoardBuilder from './BoardBuilder/BoardBuilder';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const AdminPanel = () => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down(600));
  const isLargeMobile = useMediaQuery(theme.breakpoints.down(425));
  const tabList = [
    { icon: <InfoIcon />, lable: 'Bingo Overview', value: 1 },
    { icon: <AddAPhotoIcon />, lable: 'Screenshot Submissions', value: 2 },
    { icon: <DashboardCustomizeIcon />, lable: 'Board Builder', value: 3 },
    { icon: <GamepadIcon />, lable: 'Bingo Builder', value: 4 },
    { icon: <GroupAddIcon />, lable: 'Team Drafter', value: 5 },
  ];

  const CustomTabPanel = (props: TabPanelProps) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`admin-panel-tabpanel-${index}`}
        aria-labelledby={`admin-panel-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ px: 3, py: 1.5 }}>{children}</Box>}
      </div>
    );
  };

  function a11yProps(index: number) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

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
    tab,
    setActiveTab,
  } = useAdminPanel();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(event, newValue);
  };

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
          onChange={handleTabChange}
          aria-label=""
          variant={isLargeMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons={isLargeMobile}
          allowScrollButtonsMobile={isLargeMobile}
          sx={{
            width: '100%',
            bgcolor: 'black',
            opacity: 0.5,
            '& .MuiTab-root': {
              color: 'grey',
              '&.Mui-selected': {
                color: '#2A9D8F',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#2A9D8F',
            },
            '& .MuiTabs-scrollButtons': {
              color: '#2A9D8F',
              '& .Mui-disabled': {
                opacity: 0.2,
                color: '#2A9D8F',
              },
            },
          }}
        >
          {tabList.map((tab, idx) => (
            <Tab
              key={tab.lable}
              icon={isTablet ? tab.icon : <></>}
              label={isTablet ? '' : tab.lable}
              value={tab.value}
              {...a11yProps(idx)}
            />
          ))}
        </Tabs>

        <Typography variant="h3" component={'h1'} textAlign={'center'}>
          Admin Panel
        </Typography>

        <Box sx={{ width: '100%', height: '100%' }}>
          <CustomTabPanel index={1} value={tab}>
            <Typography variant="h5" component={'h2'} textAlign={'center'}>
              Bingo Overview
            </Typography>
          </CustomTabPanel>

          <CustomTabPanel index={2} value={tab}>
            <Typography variant="h5" component={'h2'} textAlign={'center'}>
              Screenshot Submissions
            </Typography>
          </CustomTabPanel>

          <CustomTabPanel index={3} value={tab}>
            <Typography variant="h5" component={'h2'} textAlign={'center'}>
              Board Builder
            </Typography>
            <BoardBuilder boardSize={boardSize} />
          </CustomTabPanel>

          <CustomTabPanel index={4} value={tab}>
            <Typography variant="h5" component={'h2'} textAlign={'center'}>
              Bingo Builder
            </Typography>
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
            />
          </CustomTabPanel>

          <CustomTabPanel index={5} value={tab}>
            <Typography variant="h5" component={'h2'} textAlign={'center'}>
              Team Drafter
            </Typography>
          </CustomTabPanel>
        </Box>
      </Stack>
    </Stack>
  );
};

export default AdminPanel;
