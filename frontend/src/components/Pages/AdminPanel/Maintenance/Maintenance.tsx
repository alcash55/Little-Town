import { Box, Typography } from '@mui/material';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { useMaintenance } from './useMaintenance';
import { MaintenanceJobCard } from './MaintenanceJobCard';

const Maintenance = () => {
  const { jobs, running, results, runJob, dismissResult } = useMaintenance();

  return (
    <PageLayout title="Maintenance" maxWidth="full">
      <Typography variant="body2" sx={{ color: textSecondary, textAlign: 'center' }}>
        Manually re-run background jobs that normally happen on a schedule.
      </Typography>

      <Box
        component="section"
        aria-label="Maintenance jobs"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}
      >
        {jobs.map((job) => (
          <MaintenanceJobCard
            key={job.id}
            job={job}
            running={running[job.id]}
            result={results[job.id]}
            onRun={() => runJob(job)}
            onDismissResult={() => dismissResult(job.id)}
          />
        ))}
      </Box>
    </PageLayout>
  );
};

export default Maintenance;
