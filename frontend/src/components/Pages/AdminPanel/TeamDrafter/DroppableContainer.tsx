import React from 'react';
import { UniqueIdentifier, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { cardSx, textPrimary } from './teamDrafterStyles';

export function DroppableContainer({
  id,
  label,
  items,
  children,
}: {
  id: UniqueIdentifier;
  label: string;
  items: UniqueIdentifier[];
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Card sx={{ ...cardSx, height: '100%', minWidth: 170 }}>
      <CardContent>
        <Typography
          variant="h2"
          sx={{ fontSize: 16, mb: 1, color: textPrimary }}
          noWrap
        >
          {label}
        </Typography>
        <Box
          ref={setNodeRef}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            minHeight: 52,
            border: isOver ? '1.5px dashed #2A9D8F' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1,
            padding: 0.75,
            transition: 'border-color 0.15s',
          }}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </Box>
      </CardContent>
    </Card>
  );
}
