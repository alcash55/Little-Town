import { Chip } from '@mui/material';
import { InviteStatus } from './useUserInvite';

const STATUS_STYLES: Record<InviteStatus, { label: string; bgcolor: string; color: string }> = {
  active: { label: 'Active', bgcolor: 'rgba(46,160,67,0.18)', color: '#4caf50' },
  used: { label: 'Used', bgcolor: 'rgba(100,180,255,0.18)', color: '#64b4ff' },
  expired: { label: 'Expired', bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' },
  revoked: { label: 'Revoked', bgcolor: 'rgba(255,82,82,0.18)', color: '#ff5252' },
};

interface Props {
  status: InviteStatus;
}

const InviteStatusChip = ({ status }: Props) => {
  const style = STATUS_STYLES[status];
  return (
    <Chip
      label={style.label}
      size="small"
      sx={{ bgcolor: style.bgcolor, color: style.color, fontWeight: 600, fontSize: 11 }}
    />
  );
};

export default InviteStatusChip;
