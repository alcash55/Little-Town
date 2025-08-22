import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit?: (username: string, password: string) => void | Promise<void>;
}

const LoginModal = ({ open, onClose, isSubmitting = false, errorMessage, onSubmit }: Props) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) await onSubmit(username, password);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
      keepMounted
      PaperProps={{
        sx: (theme) => ({
          bgcolor: theme.palette.secondary.main,
          border: `1px solid ${theme.palette.primary.main}`,
          color: 'white',
          borderRadius: 2,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }),
      }}
      BackdropProps={{
        sx: { backgroundColor: 'rgba(0,0,0,0.7)' },
      }}
    >
      <DialogTitle>
        <Typography variant="h6" color="white">
          Login
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
          <Typography variant="body1">Enter your credentials</Typography>
          <TextField
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            InputLabelProps={{
              sx: {
                color: 'rgba(255,255,255,0.7)',
                '&.Mui-focused': { color: 'rgba(255,255,255,0.85)' },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                backgroundColor: 'transparent',
                '& fieldset': { borderColor: '#424242' },
                '&:hover fieldset': { borderColor: '#5a5a5a' },
                '&.Mui-focused fieldset': { borderColor: '#7a7a7a' },
              },
            }}
          />
          <TextField
            label="Password"
            variant="outlined"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{
              sx: {
                color: 'rgba(255,255,255,0.7)',
                '&.Mui-focused': { color: 'rgba(255,255,255,0.85)' },
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                backgroundColor: 'transparent',
                '& fieldset': { borderColor: '#424242' },
                '&:hover fieldset': { borderColor: '#5a5a5a' },
                '&.Mui-focused fieldset': { borderColor: '#7a7a7a' },
              },
            }}
          />
          {errorMessage ? (
            <Typography variant="caption" color="error">
              {errorMessage}
            </Typography>
          ) : null}
          <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
            <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{
                bgcolor: (theme) => theme.palette.primary.main,
                color: 'white',
                '&:hover': {
                  bgcolor: '#2e2e2e',
                },
              }}
            >
              {isSubmitting ? 'Logging in…' : 'Login'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions />
    </Dialog>
  );
};

export default LoginModal;
