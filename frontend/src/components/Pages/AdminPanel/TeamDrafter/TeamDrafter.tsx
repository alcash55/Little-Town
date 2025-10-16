import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { CSS } from '@dnd-kit/utilities';
import { darkTheme } from '../../../../layout/Theme';
import { useTeamDrafter } from './useTeamDrafter';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { DndContext } from '@dnd-kit/core';

/**
 * @see https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/?path=/docs/presets-sortable-multiple-containers--basic-setup
 */
const TeamDrafter = () => {
  const { containers, Dnd } = useTeamDrafter();

  return (
    <Stack
      spacing={3}
      height={'100%'}
      width={'100%'}
      justifyContent={'flex-start'}
      alignItems={'stretch'}
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Team Drafter
      </Typography>

      <Dnd>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={'stretch'}>
          {Object.entries(containers).map(([containerId, itemIds]) => (
            <DraftContainer key={containerId} id={containerId} itemIds={itemIds as string[]} />
          ))}
        </Stack>
      </Dnd>
    </Stack>
  );
};

function DraftContainer({ id, itemIds }: { id: string; itemIds: string[] }) {
  return (
    <Card sx={{ flex: 1, minWidth: 260 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {id}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <SortableContext items={itemIds}>
            {itemIds.map((itemId) => (
              <SortableItem key={itemId} id={itemId} />
            ))}
          </SortableContext>
        </Box>
      </CardContent>
    </Card>
  );
}

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;
  return (
    <Chip
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      label={id}
      sx={{ cursor: 'grab' }}
      style={style}
    />
  );
}

export default TeamDrafter;
