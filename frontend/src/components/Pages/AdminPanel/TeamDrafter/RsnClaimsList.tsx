import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { RsnClaimAdminRow } from './useTeamDrafter';
import {
  mutedText,
  outlinedButtonSx,
  tableCellSx,
  textPrimary,
  textSecondary,
} from './teamDrafterStyles';

export type RsnClaimsListProps = {
  claims: RsnClaimAdminRow[];
  onRelease: (claim: RsnClaimAdminRow) => void;
  onReassign: (claim: RsnClaimAdminRow) => void;
};

function ClaimActions({
  claim,
  onRelease,
  onReassign,
  fullWidth,
}: {
  claim: RsnClaimAdminRow;
  onRelease: (claim: RsnClaimAdminRow) => void;
  onReassign: (claim: RsnClaimAdminRow) => void;
  fullWidth?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} sx={fullWidth ? { width: '100%' } : undefined}>
      <Button
        size="small"
        variant="outlined"
        color="success"
        onClick={() => onReassign(claim)}
        sx={{ ...outlinedButtonSx, ...(fullWidth ? { flex: 1 } : {}) }}
      >
        Reassign
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={() => onRelease(claim)}
        sx={{ ...outlinedButtonSx, ...(fullWidth ? { flex: 1 } : {}) }}
      >
        Release
      </Button>
    </Stack>
  );
}

function MobileClaimCard({
  claim,
  onRelease,
  onReassign,
}: {
  claim: RsnClaimAdminRow;
  onRelease: (claim: RsnClaimAdminRow) => void;
  onReassign: (claim: RsnClaimAdminRow) => void;
}) {
  const fieldLabelSx = {
    color: textSecondary,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    mb: 0.25,
  };

  return (
    <Card
      variant="outlined"
      sx={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle1" sx={{ color: textPrimary, fontWeight: 600, mb: 1.5 }}>
          {claim.rsn}
        </Typography>
        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
          <Box>
            <Typography sx={fieldLabelSx}>Claimed By</Typography>
            <Typography variant="body2" sx={{ color: textPrimary }}>
              {claim.username || (
                <Box component="span" sx={{ color: mutedText }}>
                  (unknown)
                </Box>
              )}
            </Typography>
          </Box>
          <Box>
            <Typography sx={fieldLabelSx}>Claimed</Typography>
            <Typography variant="body2" sx={{ color: textPrimary }}>
              {new Date(claim.claimedAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Stack>
        <ClaimActions claim={claim} onRelease={onRelease} onReassign={onReassign} fullWidth />
      </CardContent>
    </Card>
  );
}

/**
 * Every current RSN claim, with release/reassign actions per row
 * (TEAM-BRIEF.md Sprint 17, Track B2 item 1). Mirrors TrackedPlayersList's
 * responsive table/card split.
 */
export function RsnClaimsList({ claims, onRelease, onReassign }: RsnClaimsListProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Stack spacing={1.5} sx={{ width: '100%' }}>
        {claims.map((claim) => (
          <MobileClaimCard
            key={claim.rsnNormalized}
            claim={claim}
            onRelease={onRelease}
            onReassign={onReassign}
          />
        ))}
      </Stack>
    );
  }

  return (
    <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            {['RSN', 'Claimed By', 'Claimed', 'Actions'].map((h, i) => (
              <TableCell
                key={h}
                align={i === 3 ? 'right' : 'left'}
                sx={{ ...tableCellSx, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((claim) => (
            <TableRow
              key={claim.rsnNormalized}
              sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}
            >
              <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap' }}>{claim.rsn}</TableCell>
              <TableCell sx={tableCellSx}>
                {claim.username || (
                  <Box component="span" sx={{ color: mutedText }}>
                    (unknown)
                  </Box>
                )}
              </TableCell>
              <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap' }}>
                {new Date(claim.claimedAt).toLocaleDateString()}
              </TableCell>
              <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                <ClaimActions claim={claim} onRelease={onRelease} onReassign={onReassign} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
