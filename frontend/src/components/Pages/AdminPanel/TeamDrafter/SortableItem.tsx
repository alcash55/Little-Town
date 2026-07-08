import { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Chip } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { textPrimary } from './teamDrafterStyles';

export function SortableItem({ id }: { id: UniqueIdentifier }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'item' },
  });

  return (
    <Chip
      icon={<DragIndicatorIcon sx={{ fill: 'rgba(255,255,255,0.6)' }} />}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      label={String(id)}
      sx={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        backgroundColor: '#2A9D8F',
        color: textPrimary,
        width: '100%',
        justifyContent: 'flex-start',
        '&:hover': { backgroundColor: '#238a7e' },
      }}
    />
  );
}
