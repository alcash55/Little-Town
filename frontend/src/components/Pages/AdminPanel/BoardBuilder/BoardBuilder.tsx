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
import Close from '@mui/icons-material/Close';
import PageLayout from '../../../../layout/PageLayout/PageLayout';

const BoardBuilder = () => {
  const {
    tilesTypeOptions,
    tileType, setTileType,
    tileTask, setTileTask,
    tilePoints, setTilePoints,
    tileKillCount, setTileKillCount,
    tileExperience, setTileExperience,
    tileDropsAmount, setTileDropsAmount,
    activities, skills, items, loading,
    board, boardSize,
    submitted,
    submitError,
    isTileValid, isBoardComplete, isExistingBoard,
    inputSx,
    addTile, removeTile, clearTileForm, clearBoard, submitBoard,
  } = useBoardBuilder();

  return (
    <PageLayout
      title="Board Builder"
      bingoItem="Board"
      maxWidth="full"
      showExistingWarning={isExistingBoard}
      error={submitError}
      submitted={submitted}
      isUpdated={isExistingBoard}
    >
      <Stack spacing={3} justifyContent="center" alignItems="center" sx={{ maxWidth: 500, width: '100%' }}>
        <FormControl variant="outlined" sx={{ m: 1, minWidth: 120, width: '100%' }} required>
          <InputLabel id="tile-type-select-label">Tile Type</InputLabel>
          <Select
            labelId="tile-type-select-label"
            id="tile-type-select"
            value={tileType.value}
            onChange={(e: SelectChangeEvent<number>) => {
              const selected = tilesTypeOptions.find((o) => o.value === e.target.value);
              if (selected) {
                setTileType(selected);
                setTileTask('');
              }
            }}
            label="Tile Type"
            sx={inputSx}
          >
            {tilesTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {tileType.value === 1 && (
          <Autocomplete
            id="tile-task-kc"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={activities}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Boss / Monster / Mini Game"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        {tileType.value === 2 && (
          <Autocomplete
            id="tile-task-xp"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={skills}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Skill"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        {tileType.value === 3 && (
          <Autocomplete
            id="tile-task-drops"
            inputValue={tileTask}
            onInputChange={(_, value) => setTileTask(value)}
            options={items}
            loading={loading}
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Item Name"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading && <CircularProgress sx={{ color: '#2A9D8F' }} size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={inputSx}
              />
            )}
          />
        )}

        <TextField
          id="tile-points"
          label="Tile Points"
          variant="outlined"
          type="number"
          fullWidth
          required
          value={tilePoints ?? ''}
          onChange={(e) => setTilePoints(Number(e.target.value))}
          sx={inputSx}
        />

        {tileType.name === 'Kill Count' ? (
          <TextField
            id="kc"
            label="Number of Kills"
            type="number"
            required
            fullWidth
            value={tileKillCount ?? ''}
            onChange={(e) => setTileKillCount(Number(e.target.value))}
            sx={inputSx}
          />
        ) : tileType.name === 'Experience' ? (
          <TextField
            id="xp"
            label="Total Experience"
            type="number"
            required
            fullWidth
            value={tileExperience ?? ''}
            onChange={(e) => setTileExperience(Number(e.target.value))}
            sx={inputSx}
          />
        ) : (
          <TextField
            id="drops"
            label="How many drops?"
            type="number"
            required
            fullWidth
            value={tileDropsAmount ?? ''}
            onChange={(e) => setTileDropsAmount(Number(e.target.value))}
            sx={inputSx}
          />
        )}

        <Stack spacing={2} direction="row" width="100%">
          <Button
            variant="outlined"
            color="success"
            disabled={!isTileValid}
            onClick={addTile}
            sx={{ width: '50%' }}
          >
            Add Tile
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={clearTileForm}
            sx={{ width: '50%' }}
          >
            Clear
          </Button>
        </Stack>

        <Typography variant="body2" sx={{ color: darkTheme.palette.text.secondary }}>
          {board.length} / {boardSize} tiles added
        </Typography>

        {isBoardComplete && (
          <Button variant="outlined" color={isExistingBoard ? 'info' : 'success'} onClick={submitBoard} fullWidth>
            {isExistingBoard ? 'Update Board' : 'Submit Board'}
          </Button>
        )}

        {board.length > 0 && (
          <Button variant="outlined" color="error" onClick={clearBoard} fullWidth>
            Clear Entire Board
          </Button>
        )}
      </Stack>

      <Box sx={{ width: '100%', boxSizing: 'border-box', pb: 8 }}>
        <Grid container spacing={2} width="100%" sx={{ p: 0 }}>
          {board.map((tile, idx) => (
            <Grid
              key={idx}
              xs={12} sm={6} md={4} lg={3}
              width="220px"
              height="200px"
              sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <Card sx={{ width: '100%', height: '100%', backgroundImage: 'linear-gradient(to bottom, #2A9D8F, rgba(13, 13, 13, 0.86))' }}>
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
    </PageLayout>
  );
};

export default BoardBuilder;
