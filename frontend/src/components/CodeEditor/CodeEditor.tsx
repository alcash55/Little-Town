import { useRef } from 'react';
import { Paper, TextField, IconButton } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { Tile } from '../types';

interface CodeEditorProps {
  json: Tile;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ json }) => {
  const codeRef = useRef<HTMLTextAreaElement | null>(null);

  const copyToClipboard = () => {
    if (codeRef.current) {
      codeRef.current.select();
      navigator.clipboard
        .writeText(codeRef.current.value)
        .then(() => {
          console.log('Code copied to clipboard');
        })
        .catch((e) => {
          console.error('Error copying code to clipboard: ', e);
        });
    }
  };

  return (
    <Paper
      sx={{
        padding: 2,
        bgcolor: '#0f1924',
        borderRadius: 5,
        color: 'white',
        overflow: 'auto',
        position: 'relative',
        width: '75%',
        height: '75%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TextField
        inputRef={codeRef}
        variant="outlined"
        fullWidth
        multiline
        value={JSON.stringify(json, null, 2)}
        InputProps={{
          readOnly: true,
        }}
        sx={{
          fontSize: '18px',
          '& .MuiInputBase-input': {
            color: 'white',
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'transparent',
            },
            '&:hover fieldset': {
              borderColor: 'transparent', // White border color on hover
            },
          },
          '& .MuiInput-underline:after': {
            borderBottomColor: 'transparent', // Change the border color when focused
          },
        }}
      />
      <IconButton
        onClick={copyToClipboard}
        sx={{
          position: 'absolute',
          top: '10px',
          right: '10px',
        }}
      >
        <ContentCopy sx={{ color: 'white' }} />
      </IconButton>
    </Paper>
  );
};
