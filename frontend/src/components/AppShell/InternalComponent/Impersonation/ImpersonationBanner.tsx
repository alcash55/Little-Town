import { useEffect, useRef } from 'react';
import { Alert, Box, Button } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { ImpersonationTarget } from '../../../../utils/impersonation';

interface ImpersonationBannerProps {
  target: ImpersonationTarget;
  onClear: () => void;
}

/**
 * Unmissable, app-wide "Viewing as X — Clear" banner (TEAM-BRIEF.md Track C
 * item 1). Rendered in AppShell between the Bar and the routed page content,
 * so it shows on every route without being threaded into each page.
 *
 * Its rendered height is published as a CSS var so PageLayout's own
 * viewport-height math (`calc(100dvh - <toolbar>)`) can subtract it — see
 * PageLayout.tsx — instead of pages either overflowing the viewport or the
 * banner clipping the bottom of the content by its own height.
 */
export const ImpersonationBanner = ({ target, onClear }: ImpersonationBannerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const publishHeight = () => {
      document.documentElement.style.setProperty(
        '--impersonation-banner-height',
        `${el.offsetHeight}px`,
      );
    };

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(el);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--impersonation-banner-height');
    };
  }, []);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <Alert
        role="status"
        severity="warning"
        variant="filled"
        icon={<PersonSearchIcon fontSize="small" />}
        action={
          <Button color="inherit" size="small" onClick={onClear} sx={{ fontWeight: 700 }}>
            Clear
          </Button>
        }
        sx={{ width: '100%', borderRadius: 0, alignItems: 'center' }}
      >
        Viewing as <strong>{target.label}</strong>
      </Alert>
    </Box>
  );
};
