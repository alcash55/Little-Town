import { useState, FormEvent } from 'react';
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Typography,
  TextField,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface Props {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  sessionExpired?: boolean;
  savedUsername?: string;
  rememberMe?: boolean;
  onSubmit?: (username: string, password: string, rememberMe: boolean) => void | Promise<void>;
}

const LoginModal = ({
  open,
  onClose,
  isSubmitting = false,
  errorMessage,
  sessionExpired,
  savedUsername = '',
  rememberMe: initialRememberMe = false,
  onSubmit,
}: Props) => {
  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(initialRememberMe);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (onSubmit) await onSubmit(username, password, rememberMe);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
      keepMounted
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(0,0,0,0.7)' },
        },

        paper: {
          sx: (theme) => ({
            bgcolor: theme.palette.secondary.main,
            border: `1px solid ${theme.palette.primary.main}`,
            color: 'white',
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }),
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h6" color="white">
          Login
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {sessionExpired && (
            <Alert
              severity="warning"
              variant="outlined"
              sx={{
                color: 'warning.light',
                borderColor: 'warning.light',
                '& .MuiAlert-icon': { color: 'warning.light' },
              }}
            >
              Your session has expired. Please log in again.
            </Alert>
          )}
          <Typography variant="body1">Enter your credentials</Typography>
          <TextField
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                backgroundColor: 'transparent',
                '& fieldset': { borderColor: '#424242' },
                '&:hover fieldset': { borderColor: '#5a5a5a' },
                '&.Mui-focused fieldset': { borderColor: '#7a7a7a' },
              },
            }}
            slotProps={{
              inputLabel: {
                sx: {
                  color: 'rgba(255,255,255,0.7)',
                  '&.Mui-focused': { color: 'rgba(255,255,255,0.85)' },
                },
              },
            }}
          />
          <TextField
            label="Password"
            variant="outlined"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                backgroundColor: 'transparent',
                '& fieldset': { borderColor: '#424242' },
                '&:hover fieldset': { borderColor: '#5a5a5a' },
                '&.Mui-focused fieldset': { borderColor: '#7a7a7a' },
              },
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },

              inputLabel: {
                sx: {
                  color: 'rgba(255,255,255,0.7)',
                  '&.Mui-focused': { color: 'rgba(255,255,255,0.85)' },
                },
              },
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                size="small"
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  '&.Mui-checked': { color: '#2A9D8F' },
                  p: 0.5,
                }}
              />
            }
            label={
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Remember me
              </Typography>
            }
            sx={{ ml: 0 }}
          />
          {errorMessage ? (
            <Typography variant="caption" color="error">
              {errorMessage}
            </Typography>
          ) : null}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              mt: 1,
            }}
          >
            <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                ) : null
              }
              sx={{
                bgcolor: (theme) => theme.palette.primary.main,
                color: 'white',
                minWidth: 90,
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
