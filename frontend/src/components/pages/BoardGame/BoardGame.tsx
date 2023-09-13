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

const BoardGame = () => {
  const theme = useTheme();
  const md = useMediaQuery(theme.breakpoints.down(700));
  const bosses = bossList();
  const [type, setType] = useState<string>('A');
  const [task, setTask] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedBoss, setSelectedBoss] = useState('');
  const [tileName, setTileName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [json, setJson] = useState<Tile>({
    name: tileName,
    tile_type: type,
    task: task,
    instructions: instructions,
    icon_url: iconUrl,
  });

  const typeA = () => (
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
        label="Instructions"
        sx={textfieldStyles}
        InputLabelProps={{
          style: { color: 'white' },
        }}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />

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

        {!md ? (
          <img src={iconUrl} alt={selectedBoss} style={{ width: 'auto', height: 128 }} />
        ) : (
          <></>
        )}
      </Box>
    </Box>
  );

  const typeB = () => {
    return (
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
          fullWidth
          variant="outlined"
          multiline
          id="task"
          label="Task"
          sx={textfieldStyles}
          InputLabelProps={{
            style: { color: 'white' },
          }}
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <TextField
          fullWidth
          variant="outlined"
          multiline
          id="instructions"
          label="Number of Tiles"
          sx={textfieldStyles}
          InputLabelProps={{
            style: { color: 'white' },
          }}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </Box>
    );
  };

  const handleSelectedIcon = (name: string) => {
    setSelectedBoss(name);
    if (type === 'A') {
      const formattedName = name.replace(/\s+/g, '_').replace(/'/g, '%27');
      if (name === 'Barrows') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Dharok_the_Wretched.png/128px-Dharok_the_Wretched.png`,
        );
      } else if (name === 'Grotesque Guardians') {
        setIconUrl(`https://oldschool.runescape.wiki/images/thumb/Dusk.png/128px-Dusk.png`);
      } else if (name === 'Chambers of Xeric') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Great_Olm.png/128px-Great_Olm.png`,
        );
      } else if (name === 'Theatre of Blood') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Verzik_Vitur.png/128px-Verzik_Vitur.png`,
        );
      } else if (name === 'Tombs of Amascut') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Tumeken%27s_Warden_%28level-489%29.png/128px-Tumeken%27s_Warden_%28level-489%29.png`,
        );
      } else if (name === 'Alchemical Hydra') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Alchemical_Hydra_%28serpentine%29.png/128px-Alchemical_Hydra_%28serpentine%29.png`,
        );
      } else if (name === 'Dagannoth Kings') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Dagannoth_Supreme.png/128px-Dagannoth_Supreme.png`,
        );
      } else if (name === 'Phantom Mustpah') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Phantom_Muspah_%28ranged%29.png/128px-Phantom_Muspah_%28ranged%29.png`,
        );
      } else if (name === 'Wintertodt') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Howling_Snow_Storm.gif/128px-Howling_Snow_Storm.gif`,
        );
      } else if (name === 'Zulrah') {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/Zulrah_%28serpentine%29.png/128px-Zulrah_%28serpentine%29.png`,
        );
      } else {
        setIconUrl(
          `https://oldschool.runescape.wiki/images/thumb/${formattedName}.png/128px-${formattedName}.png`,
        );
      }
    } else {
      setIconUrl(
        'https://static.vecteezy.com/system/resources/thumbnails/000/589/654/small/40_436.jpg',
      );
    }
  };

  const handleTypeSelect = (value: string) => {
    setType(value);
  };

  useEffect(() => {
    handleSelectedIcon(selectedBoss);
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

      {type === 'A' ? typeA() : type === 'B' ? typeB() : <></>}

      <CodeEditor json={json} />
    </Stack>
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
