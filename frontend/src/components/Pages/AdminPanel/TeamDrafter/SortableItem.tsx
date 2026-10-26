import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Chip, Tooltip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { appColors } from '../../../../layout/Theme/appColors';
import { textPrimary } from './teamDrafterStyles';

export function SortableItem({
  id,
  isUnclaimed = false,
}: {
  id: UniqueIdentifier;
  /**
   * No rsn_claims row points at this RSN yet, so an admin typed this player
   * in rather than the player confirming their own account (TEAM-BRIEF.md
   * #48, "self-claimed vs admin-entered"). Mirrors the flag Player
   * Management already shows via its own UnclaimedBadge.
   */
  isUnclaimed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item' },
  });

  const label = isUnclaimed ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {String(id)}
      <WarningAmberIcon fontSize="inherit" sx={{ color: 'warning.main' }} aria-label="unclaimed" />
    </Box>
  ) : (
    String(id)
  );

  const chip = (
    <Chip
      icon={<DragIndicatorIcon sx={{ fill: 'rgba(255,255,255,0.6)' }} />}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      label={label}
      aria-label={String(id)}
      sx={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        backgroundColor: appColors.raised,
        color: textPrimary,
        width: '100%',
        justifyContent: 'flex-start',
        '&:hover': { backgroundColor: appColors.surface },
        border: `1px solid ${appColors.cardBorder}`,
        borderRadius: 1,
        minHeight: 42,
        touchAction: 'none',
        '&:focus-visible': { outline: `2px solid ${appColors.accent}`, outlineOffset: 2 },
      }}
    />
  );

  if (!isUnclaimed) return chip;

  return (
    <Tooltip describeChild title="No linked account has claimed this RSN yet">
      {chip}
    </Tooltip>
  );
}
