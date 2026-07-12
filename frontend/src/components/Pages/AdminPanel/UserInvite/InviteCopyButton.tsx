import { useEffect, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { appColors } from '../../../../layout/Theme';

const COPY_CONFIRM_MS = 1800;

interface Props {
  url: string | null;
  label: string;
}

/** Same copy-to-clipboard shape as Resources' RuneliteCopyControl, condensed
 * to an icon button for the invites table. */
const InviteCopyButton = ({ url, label }: Props) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!url) {
    return (
      <Tooltip title="Link only shown once, at creation">
        <span>
          <IconButton
            size="small"
            disabled
            aria-label={`Copy ${label} to clipboard (unavailable — link only shown once, at creation)`}
            sx={{ color: appColors.mutedText }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const title = copyError ? 'Copy failed' : copied ? 'Copied!' : `Copy ${label}`;

  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={handleCopy}
        aria-label={`Copy ${label} to clipboard`}
        sx={{ color: copyError ? '#f44336' : copied ? appColors.accent : appColors.textSecondary }}
      >
        {copyError ? (
          <ErrorOutlineIcon fontSize="small" />
        ) : copied ? (
          <CheckIcon fontSize="small" />
        ) : (
          <ContentCopyIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default InviteCopyButton;
