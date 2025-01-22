import { Stack, TextField } from '@mui/material';

type TeamNamesProps = {
  teamNames: string[];
  setTeamNames: React.Dispatch<React.SetStateAction<string[]>>;
};

const TeamNames = ({ teamNames, setTeamNames }: TeamNamesProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newTeamNames = [...teamNames];
    newTeamNames[index] = e.target.value;
    setTeamNames(newTeamNames);
  };

  return (
    <Stack spacing={2}>
      {teamNames.map((name, index) => (
        <TextField
          key={`team-${index}`}
          id={`team-${index}`}
          label={`Team ${index + 1}`}
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e, index)}
          variant="outlined"
          fullWidth
        />
      ))}
    </Stack>
  );
};

export default TeamNames;
