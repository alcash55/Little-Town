import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

type BoardSizeProps = {
  boardSize: number;
  setBoardSize: any;
};

const BoardSize = (props: BoardSizeProps) => {
  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120, width: 'auto' }} required={true}>
      <InputLabel id="board-size-label-label">Size</InputLabel>
      <Select
        labelId="board-size-label"
        id="board-size"
        value={props.boardSize}
        onChange={(e: any) => props.setBoardSize(e.target.value)}
        label="Board Size"
      >
        <MenuItem value={16}>4X4</MenuItem>
        <MenuItem value={35}>5X5</MenuItem>
      </Select>
    </FormControl>
  );
};

export default BoardSize;
