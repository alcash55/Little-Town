import { Button } from '@mui/material';
import YouTubeIcon from '@mui/icons-material/YouTube';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LinkIcon from '@mui/icons-material/Link';
import { ResourceLink } from './types';
import { linkKindChipSx } from './resourcesStyles';

const ICONS_BY_KIND: Record<ResourceLink['kind'], typeof YouTubeIcon> = {
  youtube: YouTubeIcon,
  streamable: OndemandVideoIcon,
  imgur: ImageIcon,
  sheet: TableChartIcon,
  wiki: MenuBookIcon,
  other: LinkIcon,
};

interface LinkButtonProps {
  link: ResourceLink;
}

/** External link rendered as a labeled button with an icon per `kind` (R2.d). */
const LinkButton = ({ link }: LinkButtonProps) => {
  const Icon = ICONS_BY_KIND[link.kind];

  return (
    <Button
      component="a"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      variant="outlined"
      startIcon={<Icon fontSize="small" />}
      sx={linkKindChipSx}
    >
      {link.label}
    </Button>
  );
};

export default LinkButton;
