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
import Grid from '@mui/material/Unstable_Grid2';
import { useBoardBuilder } from './useBoardBuilder';
import { darkTheme } from '../../../../layout/Theme';
import { Close } from '@mui/icons-material';

const NAV_HEIGHT = 30; // adjust this if your header bar is taller/shorter

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
    clear,
    removeTile,
    submitBoard,
    tileKillCount,
    setTileKillCount,
    tileExperience,
    setTileExperience,
    tileDropsAmount,
    setTileDropsAmount,
    activities,
    skills,
    items,
    loading,
  } = useBoardBuilder();

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'black',
      '& fieldset': { borderColor: 'black' },
      '&:hover fieldset': { borderColor: '#2A9D8F' },
      '&.Mui-focused fieldset': { borderColor: '#2A9D8F' },
    },
    '& .MuiInputLabel-root': {
      color: 'black',
      '&.Mui-focused': { color: '#2A9D8F' },
    },
  };

  return (
    <Stack
      spacing={3}
      width="100%"
      justifyContent="flex-start"
      alignItems="center"
      sx={{
        bgcolor: darkTheme.palette.primary.main,
        p: 5,
        pt: `${NAV_HEIGHT}px`,
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflow: 'scroll',
      }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Board Builder
      </Typography>

      {/* FORM SECTION */}
      <Stack
        spacing={3}
        justifyContent="center"
        alignItems="center"
        sx={{ maxWidth: 500, width: '100%' }}
      >
        <FormControl variant="standard" sx={{ m: 1, minWidth: 120, width: '100%' }} required>
          <InputLabel id="tile-type-select-label">Tile Type</InputLabel>
          <Select
            labelId="tile-type-label"
            id="tile-type-select"
            value={tileType.value}
            onChange={(e: SelectChangeEvent<number>) => {
              const selectedOption = tilesTypeOptions.find(
                (option) => option.value === e.target.value,
              );
              if (selectedOption) setTileType(selectedOption);
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
                    {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={30} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              sx={inputSx}
            />
          )}
        />

        <TextField
          id="tile-points"
          label="Tile Points"
          variant="outlined"
          fullWidth
          required
          InputLabelProps={{ sx: { color: 'black' } }}
          value={tilePoints ?? ''}
          onChange={(e) => setTilePoints(Number(e.target.value))}
          sx={inputSx}
        />

        <Stack spacing={2} sx={{ width: '100%' }}>
          {tileType.name === 'Kill Count' ? (
            <TextField
              id="kc"
              label="Number of Kills"
              type="number"
              required
              value={tileKillCount ?? ''}
              onChange={(e) => setTileKillCount(Number(e.target.value))}
              fullWidth
              sx={inputSx}
            />
          ) : tileType.name === 'Experience' ? (
            <TextField
              id="xp"
              label="Total experience"
              type="number"
              required
              value={tileExperience ?? ''}
              onChange={(e) => setTileExperience(Number(e.target.value))}
              fullWidth
              sx={inputSx}
            />
          ) : (
            <TextField
              id="drops"
              label="How many drops?"
              type="number"
              required
              value={tileDropsAmount ?? ''}
              onChange={(e) => setTileDropsAmount(Number(e.target.value))}
              fullWidth
              sx={inputSx}
            />
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
            tilePoints !== undefined &&
            (tileKillCount || tileExperience || tileDropsAmount) && (
              <Stack spacing={2} width="100%" direction="row">
                <Button variant="outlined" onClick={addTile} color="success" sx={{ width: '50%' }}>
                  Add Tile
                </Button>

                <Button variant="outlined" onClick={clear} color="error" sx={{ width: '50%' }}>
                  Clear
                </Button>
              </Stack>
            )}

          {board.length === 16 && (
            <Button variant="outlined" color="success" onClick={submitBoard} sx={{ width: '50%' }}>
              Submit Board
            </Button>
          )}
        </Box>
      </Stack>

      {/* GRID SECTION */}
      <Box sx={{ width: '100%', boxSizing: 'border-box', pb: 8 }}>
        <Grid container spacing={2} width="100%" sx={{ p: 0 }}>
          {board.map((tile, idx) => (
            <Grid
              key={idx}
              xs={12}
              sm={6}
              md={4}
              lg={3}
              width="220px"
              height="200px"
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Card
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: 'linear-gradient(to bottom, #2A9D8F, rgba(13, 13, 13, 0.86))',
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
                  <Stack>
                    <Typography>Type: {tile.type}</Typography>
                    <Typography>Points: {tile.points}</Typography>
                    <Typography>
                      Objective:{' '}
                      {tile.type === 'Kill Count'
                        ? `Kill ${tile.killCount}`
                        : tile.type === 'Experience'
                        ? `Gain ${tile.experience} xp`
                        : `Get ${tile.dropsAmount} ${tile.task}s`}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
};

export default BoardBuilder;
