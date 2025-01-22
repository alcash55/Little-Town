import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';

type TeamInfoProps = {
  numberOfTeams: number;
  setNumberOfTeams: any;
  teamNames: string[];
  setTeamNames: any;
};

const TeamInfo = (props: TeamInfoProps) => {
  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }} required={true}>
      <InputLabel id="team-size-select-label">Size</InputLabel>
      <Select
        labelId="team-size-label"
        id="team-size"
        value={props.numberOfTeams}
        onChange={(e: any) => props.setNumberOfTeams(e.target.value)}
        label="Team Size"
      >
        <MenuItem value={3}>3</MenuItem>
        <MenuItem value={4}>4</MenuItem>
        <MenuItem value={5}>5</MenuItem>
      </Select>
    </FormControl>
  );
};

export default TeamInfo;
