import { TextField } from '@mui/material';

export const Steps = () => {
  const kcSteps = [
    {
      title: 'Activity Tile',
      questions: [
        {
          title: 'Activity',
          description: 'What Boss/Monster or Mini Game?',
          Component: <TextField required variant="outlined" />,
        },
        {
          title: 'Kill Count',
          description: 'How Many Kills?',
          Component: <TextField required variant="outlined" />,
        },
      ],
    },
  ];

  const xpSteps = [
    {
      title: 'Experience Tile',
      questions: [
        {
          title: 'Skill',
          description: 'What Skill?',
          Component: <TextField required variant="outlined" />,
        },
        {
          title: 'Experience',
          description: 'How much experience?',
          Component: <TextField required variant="outlined" />,
        },
      ],
    },
  ];

  const dropSteps = [
    {
      title: 'Drops Tile',
      questions: [
        {
          title: 'Item',
          description: 'What Iteam(s)?',
          Component: <TextField required variant="outlined" />,
        },
        {
          title: 'Nuber of Drops',
          description: 'How Many Drops?',
          Component: <TextField required variant="outlined" />,
        },
      ],
    },
  ];

  return { kcSteps, xpSteps, dropSteps };
};
