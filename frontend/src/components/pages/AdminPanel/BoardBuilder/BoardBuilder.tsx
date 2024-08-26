import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardMedia,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from '@mui/material';
import { useBoardBuilder } from './useBoardBuilder';

interface BoardBuilderProps {
  boardSize: number;
}

const BoardBuilder = (props: BoardBuilderProps) => {
  const {
    tilesTypeOptions,
    tileType,
    setTileType,
    tileTask,
    setTileTask,
    tilePoints,
    setTilePoints,
    tileWeight,
    setTileWeight,
    addTile,
    board,
  } = useBoardBuilder();

  return (
    <Stack spacing={2} width={'100%'} justifyContent={'center'} alignItems={'start'}>
      <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }} required={true}>
        <InputLabel id="team-size-select-label">Tile Type</InputLabel>
        <Select
          labelId="team-size-label"
          id="team-size"
          value={tileType}
          onChange={(e: SelectChangeEvent) => {
            setTileType(e.target.value);
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

      {tileType === 'Kill Count' ? (
        <Stack spacing={2}>
          <TextField id="kill-count-number" label="Number of Kills"></TextField>
          <TextField></TextField>
        </Stack>
      ) : tileType === 'Experience' ? (
        <Stack spacing={2}>
          <TextField></TextField>
          <TextField></TextField>
        </Stack>
      ) : (
        // Drops
        <TextField></TextField>
      )}

      <TextField
        id="tile-task"
        label="Tile Task"
        variant="outlined"
        fullWidth
        required={true}
        InputLabelProps={{ sx: { color: 'black' } }}
        sx={{
          borderColor: 'black',
          color: 'black',
          '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline .MuiInputLabel-outlined': {
            borderColor: 'black',
            color: 'black',
          },
        }}
      />

      {board.length === 15 ? (
        <Button>Submit Board</Button>
      ) : (
        <Button
          variant="outlined"
          onClick={addTile}
          sx={{
            width: 'auto',
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

      <Box sx={{ width: '100%', height: '100%' }}>
        {board.map((tile) => (
          <Card key={tile.task}>
            <CardHeader title={tile.task} subheader={`${tile.type} + ${tile.points}`} />
            <CardContent>
              <CardMedia />
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
};

export default BoardBuilder;
