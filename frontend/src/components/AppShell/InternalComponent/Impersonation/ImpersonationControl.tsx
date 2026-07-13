import { useCallback, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  IconButton,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { ImpersonationTarget } from '../../../../utils/impersonation';
import { appColors } from '../../../../layout/Theme';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

// TEAM-BRIEF.md Track A item 2 (frozen contract): GET /api/admin/users ->
// bare `{ users: [{ id, label, role }] }`. `label` is Track A's call for
// "whatever best identifies a user in a dropdown" (rsn/username/email),
// documented in their report — this UI just displays it verbatim.
interface AdminUserOption {
  id: string;
  label: string;
  role: 'user' | 'admin' | 'moderator';
}

interface ImpersonationControlProps {
  activeTarget: ImpersonationTarget | null;
  onActivate: (target: ImpersonationTarget) => void;
  onClear: () => void;
}

/**
 * Admin-only "view as user" picker, mounted in the app bar (TEAM-BRIEF.md
 * Track C item 1). Rendering is gated by the caller (Bar.tsx checks
 * `user.role === 'admin'`) — this component assumes it's only ever mounted
 * for a real admin.
 */
export const ImpersonationControl = ({
  activeTarget,
  onActivate,
  onClear,
}: ImpersonationControlProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [users, setUsers] = useState<AdminUserOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(anchorEl);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/users`);
      if (!res.ok) {
        setError(
          res.status === 404
            ? 'Not available yet — the admin/users endpoint isn’t deployed.'
            : `Failed to load users (${res.status}).`,
        );
        setUsers([]);
        return;
      }
      const json: { users?: AdminUserOption[] } = await res.json();
      const list = Array.isArray(json.users) ? json.users : [];
      // The backend also refuses to let an admin impersonate another admin
      // (TEAM-BRIEF.md Track A item 2) — filtered here too so the picker
      // never offers an option the server would reject.
      setUsers(list.filter((candidate) => candidate.role !== 'admin'));
    } catch {
      setError('Failed to load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (users === null) void loadUsers();
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Tooltip title={activeTarget ? `Viewing as ${activeTarget.label}` : 'View as user'}>
        <IconButton
          aria-label="Impersonate a user"
          size="large"
          onClick={handleOpen}
          sx={{
            color: activeTarget ? appColors.accent : 'white',
            '&:hover': { bgcolor: '#163a36' },
          }}
        >
          <SupervisorAccountIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, width: 320 } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          View app as…
        </Typography>

        {activeTarget && (
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
              Currently: <strong>{activeTarget.label}</strong>
            </Typography>
            <Button size="small" onClick={onClear}>
              Stop
            </Button>
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}

        <Autocomplete<AdminUserOption>
          options={users ?? []}
          loading={loading}
          loadingText="Loading users…"
          noOptionsText={error ? 'Unable to load users.' : 'No users found.'}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_event, value) => {
            if (value) {
              onActivate({ id: value.id, label: value.label });
              handleClose();
            }
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search users…" size="small" autoFocus />
          )}
        />
      </Popover>
    </>
  );
};
