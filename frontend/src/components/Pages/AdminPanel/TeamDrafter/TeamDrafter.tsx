import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  KeyboardCoordinateGetter,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragCancelEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, Chip, Stack, Typography, Box, colors } from '@mui/material';
import { MeasuringStrategy as _MeasuringStrategy, UniqueIdentifier } from '@dnd-kit/core';
import { darkTheme } from '../../../../layout/Theme';
import Grid from '@mui/material/Unstable_Grid2';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

type Items = Record<UniqueIdentifier, UniqueIdentifier[]>;

export default function TeamDrafterMultiple() {
  // initial items: pool + teams
  const [items, setItems] = useState<Items>(() => ({
    pool: ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7'],
    TeamA: [],
    TeamB: [],
    TeamC: [],
    TeamD: [],
    TeamE: [],
    TeamF: [],
    TeamG: [],
    TeamH: [],
    TeamI: [],
  }));

  // container order (we want pool first)
  const [containers, setContainers] = useState<UniqueIdentifier[]>(() => Object.keys(items));

  // active dragging id (for overlay)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // helpers to track lastOver and movement across containers (copied pattern from example)
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  // sensors
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: undefined as unknown as KeyboardCoordinateGetter, // Optional keyboard support: provide if you have one
    }),
  );

  // find which container an item id belongs to
  const findContainer = (id: UniqueIdentifier | null | undefined): UniqueIdentifier | undefined => {
    if (!id) return undefined;
    if (id in items) return id; // it's a container id
    return Object.keys(items).find((key) => items[key].includes(id));
  };

  const getIndex = (id: UniqueIdentifier) => {
    const container = findContainer(id);
    if (!container) return -1;
    return items[container].indexOf(id);
  };

  // Collision detection patterned after the example to prefer pointer within, then rect intersection, then cache
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // If dragging a container (not used here) fallback to closestCenter on containers
    // Otherwise try pointerWithin first then rectIntersection
    const pointerIntersections = pointerWithin(args);
    const intersections =
      pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
    const overId = getFirstCollision(intersections, 'id');

    if (overId != null) {
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    // if recently moved to new container, return cached lastOver or active
    if (recentlyMovedToNewContainer.current && args.active) {
      lastOverId.current = args.active.id;
    }

    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  useEffect(() => {
    // reset the flag after layout settles
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [items]);

  // --- Handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId) return;

    // ignore if dragging a container id (we only drag items)
    if (active.id in items) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    // Move the active item into the overContainer at the appropriate index
    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];

      const activeIndex = activeItems.indexOf(active.id as string);
      // if overId is actually a container id (dropped into empty container), place at end
      const overIndex = overId in prev ? overItems.length : overItems.indexOf(overId as string);

      // Build new arrays
      const newActiveItems = [...activeItems];
      newActiveItems.splice(activeIndex, 1);

      const newOverItems = [...overItems];
      // place active item into newOverItems at overIndex
      const insertIndex = overIndex >= 0 ? overIndex : newOverItems.length;
      newOverItems.splice(insertIndex, 0, active.id as UniqueIdentifier);

      recentlyMovedToNewContainer.current = true;

      return {
        ...prev,
        [activeContainer]: newActiveItems,
        [overContainer]: newOverItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // If an item (not a container) was dragged
    if (!(active.id in items)) {
      const activeContainer = findContainer(active.id);
      const overContainer = findContainer(over.id);

      if (!activeContainer || !overContainer) return;

      const activeIndex = items[activeContainer].indexOf(active.id as string);
      const overIndex = items[overContainer].indexOf(over.id as string);

      // If same container, just reorder (use arrayMove)
      if (activeContainer === overContainer && activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }));
        return;
      }

      // If moved between containers, it's already been placed in onDragOver, but if user dropped on empty container (over was container id),
      // ensure active was removed from source and appended to destination if needed.
      if (activeContainer !== overContainer) {
        setItems((prev) => {
          // If onDragOver already updated, ensure no duplication
          const wasAlreadyMoved =
            !prev[activeContainer].includes(active.id as string) &&
            prev[overContainer].includes(active.id as string);
          if (wasAlreadyMoved) {
            return prev;
          }

          const newActiveItems = prev[activeContainer].filter((i) => i !== active.id);
          const newOverItems = [...prev[overContainer], active.id as UniqueIdentifier];

          return {
            ...prev,
            [activeContainer]: newActiveItems,
            [overContainer]: newOverItems,
          };
        });
      }
    } else {
      // If a container was dragged (not used here), you could reorder containers
      if (active.id in items && over.id && over.id in items && active.id !== over.id) {
        setContainers((prev) => {
          const oldIndex = prev.indexOf(active.id as UniqueIdentifier);
          const newIndex = prev.indexOf(over.id as UniqueIdentifier);
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
    }
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveId(null);
  };

  /**
   * Container component, pool and teams
   * @returns  JSX.Element
   */
  function DroppableContainer({
    id,
    children,
    label,
  }: {
    id: UniqueIdentifier;
    children?: React.ReactNode;
    label?: string;
  }) {
    // Make container itself sortable
    const { attributes, listeners, isDragging, setNodeRef, transform, transition, over, active } =
      useSortable({
        id,
        data: {
          type: 'container',
          children: items[id] ?? [],
        },
      });

    // Whether a draggable item is hovering over the container
    const isOverContainer = over?.id === id || (over && items[id] && items[id].includes(over.id));

    return (
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          minWidth: 260,
          flex: 1,
          opacity: isDragging ? 0.5 : 1,
          transform: CSS.Translate.toString(transform),
          transition,
        }}
      >
        <CardContent>
          <Typography variant="h1" fontSize={18} gutterBottom>
            {label ?? id}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              minHeight: 48,
              border: isOverContainer ? '1px dashed rgba(0,0,0,0.4)' : '1px solid transparent',
              padding: 1,
              borderRadius: 1,
            }}
          >
            <SortableContext items={items[id] ?? []} strategy={verticalListSortingStrategy}>
              {children}
            </SortableContext>
          </Box>
        </CardContent>
      </Card>
    );
  }

  /**
   * Player chips
   * @returns JSX.Element
   */
  function SortableItem({
    id,
    containerId,
  }: {
    id: UniqueIdentifier;
    containerId: UniqueIdentifier;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
      data: { containerId },
    });

    return (
      <Chip
        icon={<DragIndicatorIcon sx={{ fill: 'black' }} />}
        variant="filled"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        label={String(id)}
        sx={{
          transform: CSS.Translate.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          cursor: 'grab',
          backgroundColor: '#2A9D8F',
        }}
      />
    );
  }

  // Drag overlay render
  function renderDragOverlay(id: UniqueIdentifier | null) {
    if (!id) return null;
    // If dragging a container id, you could render container overlay; in our usage it's always item id
    return <Chip label={String(id)} sx={{ p: 1 }} />;
  }

  return (
    <Stack
      spacing={3}
      height="100vh"
      width="100%"
      justifyContent="flex-start"
      alignItems="stretch"
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Team Drafter
      </Typography>

      <Typography variant="body1">
        To draft players onto a team, drag player in the pool and drop them to the desired team
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* --- MAIN LAYOUT: POOL LEFT, TEAMS RIGHT --- */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            height: '100%',
            width: '100%',
            gap: 2,
          }}
        >
          {/* Pool column */}
          <Box
            sx={{ width: '25%', height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <DroppableContainer id="pool" label="Pool">
              {(items['pool'] || []).map((itemId) => (
                <SortableItem key={String(itemId)} id={itemId} containerId="pool" />
              ))}
            </DroppableContainer>
          </Box>

          {/* Teams grid */}
          <Grid
            container
            spacing={2}
            sx={{
              flex: 1,
              height: '100%',
              alignContent: 'flex-start',
            }}
          >
            {containers.slice(1).map((containerId: UniqueIdentifier) => (
              <Grid
                key={containerId}
                xs={12}
                sm={6}
                md={4}
                lg={3}
                display="flex"
                justifyContent="center"
                alignItems="flex-start"
              >
                <DroppableContainer id={containerId} label={String(containerId)}>
                  {(items[containerId] || []).map((itemId) => (
                    <SortableItem key={String(itemId)} id={itemId} containerId={containerId} />
                  ))}
                </DroppableContainer>
              </Grid>
            ))}
          </Grid>
        </Box>

        <DragOverlay>{renderDragOverlay(activeId)}</DragOverlay>
      </DndContext>
    </Stack>
  );
}
