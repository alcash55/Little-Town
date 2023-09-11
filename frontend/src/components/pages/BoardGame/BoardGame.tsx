import React, { useState } from 'react';
import {
  Box,
  Stack,
  TextField,
  Select,
  Typography,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { darkTheme } from '../../../layout/Theme';
import { BossList } from '../../types';
import { bossList } from './bossList';

const BoardGame = () => {
  const [type, setType] = useState<string>('A');
  const [task, setTask] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedBoss, setSelectedBoss] = useState('');

  const textfieldStyles = {
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: 'white', // White border color
      },
      '&:hover fieldset': {
        borderColor: 'white', // White border color on hover
      },
      '&.Mui-focused fieldset': {
        borderColor: 'white', // White border color when focused
      },
    },
    '& .MuiInputBase-input': {
      color: 'white', // White text color
    },
    '& .MuiInputLabel-root': {
      color: 'white', // White label color
    },
  };

  const selectStyles = {
    '& .MuiInputBase-input': {
      color: 'white', // White text color
    },

    '& .MuiSelect-icon': {
      color: 'white', // White icon color
    },

    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'white',
      color: 'white',
    },
  };

  const typeA = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 2,
        mt: 2,
      }}
    >
      <TextField
        multiline
        variant="outlined"
        id="task"
        label="Task"
        inputProps={{ color: 'white' }}
        sx={textfieldStyles}
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <TextField
        multiline
        variant="outlined"
        id="instructions"
        label="Instructions"
        sx={textfieldStyles}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <Box width={'50%'}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'white',
              color: 'white',
            },
          }}
        >
          <InputLabel
            id="instructions"
            sx={{
              color: 'white',
            }}
          >
            Select Tile Type
          </InputLabel>
          <Select
            id="iconUrl"
            label="Select Boss"
            value={selectedBoss}
            onChange={(e) => setSelectedBoss(e.target.value)}
            sx={selectStyles}
          >
            {/* {bossList.map((boss) => (
          <MenuItem key={boss.id} value={boss.name}>
            {boss.name}
          </MenuItem>
        ))} */}
            <MenuItem>hello</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Box>
  );

  const typeB = () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 2,
        mt: 2,
      }}
    >
      <TextField
        variant="outlined"
        multiline
        id="task"
        label="Task"
        inputProps={{ color: 'white' }}
        sx={textfieldStyles}
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <TextField
        variant="outlined"
        multiline
        id="instructions"
        label="Instructions"
        inputProps={{ color: 'white' }}
        sx={textfieldStyles}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <Box width={'50%'}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'white',
              color: 'white',
            },
          }}
        >
          <InputLabel
            id="instructions"
            sx={{
              color: 'white',
            }}
          >
            Select Tile Type
          </InputLabel>
          <Select
            id="iconUrl"
            label="Select Boss"
            value={selectedBoss}
            onChange={(e) => setSelectedBoss(e.target.value)}
            sx={selectStyles}
          >
            {/* {bossList.map((boss) => (
          <MenuItem key={boss.id} value={boss.name}>
            {boss.name}
          </MenuItem>
        ))} */}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );

  const createJSON = () => {
    console.log('clicked');
  };

  const handleTypeSelect = (value: string) => {
    setType(value);
  };

  return (
    <Box height={'100%'} width={'100%'} p={2} sx={{ bgcolor: darkTheme.palette.primary.main }}>
      <Stack spacing={2} justifyContent="center" alignItems="center" textAlign={'center'}>
        <Typography variant="h1" paddingBottom={5}>
          Board Game Config
        </Typography>

        <Box width={'50%'}>
          <FormControl
            fullWidth
            // sx={{
            //   '& .MuiOutlinedInput-notchedOutline': {
            //     borderColor: 'white',
            //     color: 'white',
            //   },
            // }}
          >
            <InputLabel
              id="instructions"
              sx={{
                color: 'white',
              }}
            >
              Select Tile Type
            </InputLabel>
            <Select
              variant="outlined"
              id="tileType"
              label="Select Tile Type"
              value={type}
              onChange={(e) => handleTypeSelect(e.target.value as string)}
              sx={selectStyles}
            >
              <MenuItem value={'A'}>A - Get Collection Log Drop</MenuItem>
              <MenuItem value={'B'}>B - Go Back X amount of Tiles</MenuItem>
            </Select>
          </FormControl>

          {type === 'A' ? typeA() : type === 'B' ? typeB() : <></>}
        </Box>

        <Button
          onClick={createJSON}
          variant="outlined"
          size="large"
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Submit
        </Button>
      </Stack>
    </Box>
  );
};

export default BoardGame;

// {
//   "name": "MyBoard",
//   "tiles": [
//     {
//       "name": "Tile1",
//       "tile_type": "TypeA",
//       "task": "task for Tile 1",
//       "instructions": 'insert task instructions'
//       "icon_url": "A"
//     },
//     {
//       "name": "Tile2",
//       "tile_type": "TypeB",
//       "task": "insert number of tiles to go back",
//       "instructions": 'Go back'
//       "icon_url": "Arrow back icon"
//     }
//   ]
// }
