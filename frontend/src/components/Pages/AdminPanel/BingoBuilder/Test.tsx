import React, { useState } from 'react';
import { Stepper, Step, StepLabel, TextField, Button, Box } from '@mui/material';

type Question = {
  label: string;
  description: string;
  value: string;
};

const descriptions = [
  "Enter the name of the bingo, this will be displayed above the bingo board.",
  "Select when the bingo will start and end.",
  "Select the size of the bingo board.",
  "Select the total number of teams that will play in this bingo.",
  "Enter each team's name.",
];

const steps = [
  "Bingo Name",
  "Bingo Start & End Dates",
  "Board Size",
  "Number of teams",
  "Team Names",
];

const StepperForm: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Question[]>([
    { label: steps[0], description: descriptions[0], value: '' },
    { label: steps[1], description: descriptions[1], value: '' },
    { label: steps[2], description: descriptions[2], value: '' },
    { label: steps[3], description: descriptions[3], value: '' },
    { label: steps[4], description: descriptions[4], value: '' },
  ]);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prevStep => prevStep - 1);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const newAnswers = [...answers];
    newAnswers[activeStep].value = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    console.log('Form submitted:', answers);
    // Process the form data here, for example, sending it to a server
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label, index) => (
          <Step key={index}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ marginTop: 4 }}>
        <TextField
          fullWidth
          label={steps[activeStep]}
          variant="outlined"
          value={answers[activeStep].value}
          onChange={handleChange}
        />

        <Box sx={{ marginTop: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={answers[activeStep].value === ''}
          >
            Next
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBack}
            sx={{ marginLeft: 2 }}
            disabled={activeStep === 0}
          >
            Back
          </Button>
        </Box>
        {activeStep === steps.length - 1 && (
          <Box sx={{ marginTop: 2 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
            >
              Submit
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default StepperForm;
