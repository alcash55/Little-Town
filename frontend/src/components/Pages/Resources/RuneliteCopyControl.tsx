import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { RuneliteConfig } from './types';
import { subtleBorder, textPrimary, textSecondary, accent } from './resourcesStyles';

interface RuneliteCopyControlProps {
  config: RuneliteConfig;
}

const KIND_LABELS: Record<RuneliteConfig['kind'], string> = {
  npcMarkers: 'NPC markers',
  tileMarkers: 'Tile markers',
  other: 'RuneLite config',
};

const COPY_CONFIRM_MS = 1800;

/**
 * Compact "copy full JSON to clipboard" control (R2.e). Never renders the
 * full payload inline — only a truncated single-line preview — so 14
 * categories' worth of RuneLite blobs don't bloat the layout.
 */
const RuneliteCopyControl = ({ config }: RuneliteCopyControlProps) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(config.json);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const preview = config.json.length > 60 ? `${config.json.slice(0, 60)}…` : config.json;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        border: `1px solid ${subtleBorder}`,
        borderRadius: 1,
        px: 1.5,
        py: 1,
        bgcolor: 'rgba(0,0,0,0.25)',
      }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="caption" sx={{ color: textSecondary, display: 'block' }}>
          RuneLite &middot; {KIND_LABELS[config.kind]}
        </Typography>
        <Typography variant="body2" sx={{ color: textPrimary, fontWeight: 600 }}>
          {config.label}
        </Typography>
        <Typography
          variant="caption"
          component="code"
          sx={{
            color: textSecondary,
            fontFamily: 'monospace',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {preview}
        </Typography>
      </Box>
      <Button
        size="small"
        variant="outlined"
        onClick={handleCopy}
        aria-label={`Copy ${config.label} RuneLite JSON to clipboard`}
        startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        sx={{
          flexShrink: 0,
          color: copied ? accent : textPrimary,
          borderColor: copied ? accent : subtleBorder,
          '&:hover': { borderColor: accent, bgcolor: 'rgba(42,157,143,0.08)' },
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </Button>
      {copyError && (
        <Typography variant="caption" role="alert" sx={{ color: '#f44336' }}>
          Copy failed
        </Typography>
      )}
    </Box>
  );
};

export default RuneliteCopyControl;
