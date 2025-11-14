import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { useBoardBuilder } from './useBoardBuilder';
import { darkTheme } from '../../../../layout/Theme';
import { Close } from '@mui/icons-material';

const BoardBuilder = () => {
  const {
    tilesTypeOptions,
    tileType,
    setTileType,
    tileTask,
    setTileTask,
    tilePoints,
    setTilePoints,
    addTile,
    board,
    removeTile,
    submitBoard,
    tileKillCount,
    setTileKillCount,
    tileExperience,
    setTileExperience,
    tileDrops,
    setTileDrops,
    tileDropsAmount,
    setTileDropsAmount,
    activities,
    skills,
    items,
    options,
    setOptions,
    loading,
  } = useBoardBuilder();

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'black', // text color
      '& fieldset': {
        borderColor: 'black', // default border
      },
      '&:hover fieldset': {
        borderColor: '#2A9D8F', // hover border
      },
      '&.Mui-focused fieldset': {
        borderColor: '#2A9D8F', // focused border
      },
    },
    '& .MuiInputLabel-root': {
      color: 'black', // label color
      '&.Mui-focused': {
        color: '#2A9D8F', // focused label color
      },
    },
  };

  return (
    <Stack
      spacing={3}
      height={'100%'}
      width={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Board Builder
      </Typography>

      <Stack
        spacing={3}
        justifyContent={'center'}
        alignItems={'center'}
        sx={{ maxWidth: 500, width: '100%', height: '100%' }}
      >
        {/* Select the type of tile */}
        <FormControl variant="standard" sx={{ m: 1, minWidth: 120, width: '100%' }} required={true}>
          <InputLabel id="tile-type-select-label">Tile Type</InputLabel>
          <Select
            labelId="tile-type-label"
            id="tile-type-select"
            value={tileType.value}
            onChange={(e: SelectChangeEvent<number>) => {
              const selectedOption = tilesTypeOptions.find(
                (option) => option.value === e.target.value,
              );
              if (selectedOption) {
                setTileType(selectedOption);
              }
            }}
            label="Tile Type"
          >
            {tilesTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Select option */}
        <Autocomplete
          id="tile-task"
          freeSolo
          inputValue={tileTask}
          onInputChange={(_, value) => setTileTask(value)}
          options={tileType.value === 1 ? activities : tileType.value === 2 ? skills : items}
          sx={{ width: '100%' }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={
                tileType.value === 1
                  ? 'Boss/monster or Mini Game'
                  : tileType.value === 2
                  ? 'Skill'
                  : 'Item name'
              }
              InputLabelProps={{ sx: { color: 'black' } }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress sx={{ color: '#2A9D8F' }} size={30} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              sx={inputSx}
            />
          )}
        />

        {/* tile points */}
        <TextField
          id="tile-points"
          label="Tile Points"
          variant="outlined"
          fullWidth
          required={true}
          InputLabelProps={{ sx: { color: 'black' } }}
          value={tilePoints ?? ''}
          onChange={(e) => {
            setTilePoints(Number(e.target.value));
          }}
          sx={inputSx}
        />

        <Stack spacing={2} sx={{ width: '100%' }}>
          {tileType.name === 'Kill Count' ? (
            // KC
            <TextField
              id="kc"
              label="Number of Kills"
              type="number"
              required={true}
              value={tileKillCount ?? ''}
              onChange={(e) => {
                setTileKillCount(Number(e.target.value));
              }}
              fullWidth
              sx={inputSx}
            />
          ) : tileType.name === 'Experience' ? (
            // XP
            <TextField
              id="xp"
              label="Total experience"
              type="number"
              required={true}
              value={tileExperience ?? ''}
              onChange={(e) => {
                setTileExperience(Number(e.target.value));
              }}
              fullWidth
              sx={inputSx}
            />
          ) : (
            // Drops
            <Stack spacing={2} sx={{ width: '100%' }}>
              <TextField
                id="drops"
                label="What drop(s)?"
                type="text"
                required={true}
                value={tileDrops ?? ''}
                onChange={(e) => {
                  setTileDrops(e.target.value);
                }}
                fullWidth
                sx={inputSx}
              />

              {/* number of drops */}
              <TextField
                id="drops"
                label="How many drops?"
                type="text"
                required={true}
                value={tileDropsAmount ?? ''}
                onChange={(e) => {
                  setTileDropsAmount(Number(e.target.value));
                }}
                fullWidth
                sx={inputSx}
              />
            </Stack>
          )}
        </Stack>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '100%',
            gap: 1,
          }}
        >
          {tileTask &&
            tilePoints != undefined &&
            (tileKillCount || tileExperience || tileDrops) && (
              <Button
                variant="outlined"
                onClick={addTile}
                sx={{
                  width: '50%',
                  color: '#2A9D8F',
                  borderColor: '#2A9D8F',
                  '&:hover': {
                    borderColor: '#1c5952',
                    color: '#1c5952',
                  },
                }}
              >
                Add Tile
              </Button>
            )}

          {board.length === 16 && (
            <Button variant="outlined" color="success" onClick={submitBoard} sx={{ width: '50%' }}>
              Submit Board
            </Button>
          )}
        </Box>
      </Stack>

      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {board.map((tile) => {
          return (
            <Card
              key={tile.task}
              sx={{
                maxHeight: '225px',
                maxWidth: '225px',
                backgroundImage: 'linear-gradient(to bottom, #2A9D8F,rgba(13, 13, 13, 0.9))',
              }}
            >
              <CardHeader
                title={tile.task}
                action={
                  <IconButton aria-label="remove tile" onClick={() => removeTile(tile)}>
                    <Close />
                  </IconButton>
                }
              />
              <CardContent>
                <Stack spacing={1}>
                  <Typography>Type: {tile.type}</Typography>
                  <Typography>Points: {tile.points}</Typography>
                  <Typography>
                    Objective:{' '}
                    {tile.type === 'Kill Count'
                      ? `Kill ${tile.killCount}`
                      : tile.type === 'Experience'
                      ? `Gain ${tile.experience} xp`
                      : `Get ${tile.dropsAmount} ${tile.drops}s`}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Stack>
  );
};

export default BoardBuilder;
