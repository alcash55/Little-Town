import { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  TextField,
  Select,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { CodeEditor } from '../../CodeEditor/CodeEditor';
import { darkTheme } from '../../../layout/Theme';
import { selectStyles } from '../../../assets/styles/boardGameStyles';
import { textfieldStyles } from '../../../assets/styles/boardGameStyles';
import { bossList } from './bossList';
import { Tile } from '../../types';
import { useIconUrl } from './useIconUrl';

const BoardGame = () => {
  const theme = useTheme();
  const md = useMediaQuery(theme.breakpoints.down(700));
  const bosses = bossList();
  const [type, setType] = useState<string>('A');
  const [task, setTask] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [selectedBoss, setSelectedBoss] = useState<string>('');
  const [tileName, setTileName] = useState<string>('');
  const [iconUrl, setIconUrl] = useState<string>('');
  const [json, setJson] = useState<Tile>({
    name: tileName,
    tile_type: type,
    task: task,
    instructions: instructions,
    icon_url: iconUrl,
  });

  const form = (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 3,
        mt: 2,
        width: '100%',
      }}
    >
      <TextField
        multiline
        fullWidth
        variant="outlined"
        id="task"
        label="Task"
        inputProps={{ color: 'white' }}
        sx={textfieldStyles}
        InputLabelProps={{
          style: { color: 'white' },
        }}
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />

      <TextField
        multiline
        fullWidth
        variant="outlined"
        id="instructions"
        label={type === 'A' ? 'Instructions' : 'Number of Tiles'}
        sx={textfieldStyles}
        InputLabelProps={{
          style: { color: 'white' },
        }}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />

      {type === 'A' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '50%',
          }}
        >
          <FormControl fullWidth>
            <InputLabel
              id="instructions"
              sx={{
                color: 'white',
              }}
            >
              Select Boss
            </InputLabel>
            <Select
              id="iconUrl"
              label="Select Boss"
              value={selectedBoss}
              onChange={(e) => {
                setSelectedBoss(e.target.value);
              }}
              sx={selectStyles}
            >
              {bosses.map((boss) => (
                <MenuItem key={boss.id} value={boss.name}>
                  {boss.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!md && <img src={iconUrl} alt={selectedBoss} style={{ width: 'auto', height: 128 }} />}
        </Box>
      )}
    </Box>
  );

  const handleTypeSelect = (value: string) => {
    setType(value);
  };

  useEffect(() => {
    useIconUrl(selectedBoss, setSelectedBoss, type, setIconUrl);
    console.log(iconUrl);
    setInstructions(instructions);
    setTask(task);
    setType(type);
    setTileName(tileName);
    setJson({
      name: tileName,
      tile_type: type,
      task: task,
      instructions: instructions,
      icon_url: iconUrl,
    });
  }, [task, type, tileName, selectedBoss, instructions, iconUrl]);

  return (
    <Stack
      spacing={1}
      justifyContent="center"
      alignItems="center"
      width={'100%'}
      height={'100%'}
      p={3}
      sx={{ bgcolor: darkTheme.palette.primary.main }}
    >
      <Typography variant="h1" fontSize={64} pb={2}>
        Board Game Config
      </Typography>

      <Typography variant="body1" fontSize={20}>
        Fill out the form to have the JSON print out at the bottom
      </Typography>

      <Box sx={{ width: '50%' }}>
        <FormControl fullWidth>
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
            onChange={(e) => handleTypeSelect(e.target.value)}
            sx={selectStyles}
          >
            <MenuItem value={'A'}>A - Get Collection Log Drop</MenuItem>
            <MenuItem value={'B'}>B - Go Back X amount of Tiles</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TextField
        fullWidth
        variant="outlined"
        id="icon"
        label="Tile Name"
        sx={textfieldStyles}
        value={tileName}
        onChange={(e) => setTileName(e.target.value)}
        InputLabelProps={{
          style: { color: 'white' },
        }}
      />

      {form}

      <CodeEditor json={json} />
    </Stack>
  );
};

export default BoardGame;
