import { Box } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

type BingoDatesProps = {
  startDate: string;
  setStartDate: any;
  endDate: string;
  setEndDate: any;
};

const BingoDates = (props: BingoDatesProps) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center', gap: 3 }}>
      <DateTimePicker
        label="Start"
        views={['day', 'month', 'hours']}
        showDaysOutsideCurrentMonth
        disablePast
        value={new Date(props.startDate)}
        onChange={(newDate) => {
          props.setStartDate(String(newDate));
          console.log(props.startDate);
        }}
        slotProps={{
          textField: {
            required: true,
          },
        }}
      />
      <DateTimePicker
        label="End"
        views={['day', 'month', 'hours']}
        showDaysOutsideCurrentMonth
        value={new Date(props.endDate)}
        onChange={(newDate) => {
          props.setEndDate(String(newDate));
          console.log(props.endDate);
        }}
        slotProps={{
          textField: {
            required: true,
          },
        }}
      />
    </Box>
  );
};

export default BingoDates;
