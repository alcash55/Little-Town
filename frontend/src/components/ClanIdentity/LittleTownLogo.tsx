import { Box } from '@mui/material';
import logo from '../../assets/Images/Little_Town.png';
export function LittleTownLogo({ hero = false }: { hero?: boolean }) {
  return (
    <Box
      component="img"
      src={logo}
      alt="Little Town custom logo"
      sx={{
        display: 'block',
        width: hero ? '100%' : 64,
        height: hero ? 'auto' : 44,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}
