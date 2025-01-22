
import { TextField } from '@mui/material';

type BasicInfoProps = {
  bingoName: string;
  setBingoName: any;
};

const BasicInfo = (props: BasicInfoProps) => {
  return (
    <TextField
      id="bingo-name"
      label="Bingo Name"
      placeholder={`${new Date().getFullYear()} Little Town Bingo`}
      variant="outlined"
      value={props.bingoName}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        props.setBingoName(e.target.value);
      }}
      fullWidth
      required={true}
      autoFocus
    />
  );
};

export default BasicInfo;
