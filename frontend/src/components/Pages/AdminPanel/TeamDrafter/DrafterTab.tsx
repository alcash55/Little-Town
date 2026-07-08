import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { DraftItems, BingoTeam } from './useTeamDrafter';
import { DroppableContainer } from './DroppableContainer';
import { SortableItem } from './SortableItem';
import { outlinedButtonSx, textPrimary } from './teamDrafterStyles';

export type DrafterTabProps = {
  teams: BingoTeam[];
  draftItems: DraftItems;
  setDraftItems: React.Dispatch<React.SetStateAction<DraftItems>>;
  anyTeamHasPlayers: boolean;
  poolIsEmpty: boolean;
  showSubmitButton: boolean;
  submitTeamsDisabled: boolean;
  submitTeamsLabel: string;
  submitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  submitDraft: () => void;
  resetDraft: () => void;
  loadingBingo: boolean;
  bingoError: string | null;
};

export function DrafterTab({
  teams,
  draftItems,
  setDraftItems,
  anyTeamHasPlayers,
  showSubmitButton,
  submitTeamsDisabled,
  submitTeamsLabel,
  submitting,
  submitError,
  submitSuccess,
  submitDraft,
  resetDraft,
  loadingBingo,
  bingoError,
}: DrafterTabProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const findContainer = (id: UniqueIdentifier): string | undefined => {
    if (id in draftItems) return id as string;
    return Object.keys(draftItems).find((key) => draftItems[key].includes(id as string));
  };

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      const overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        lastOverId.current = overId;
        return [{ id: overId }];
      }
      if (recentlyMovedToNewContainer.current && args.active) {
        lastOverId.current = args.active.id;
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [draftItems],
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [draftItems]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (active.id in draftItems) return;
    setActiveId(active.id);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const overId = over?.id;
    if (!overId || active.id in draftItems) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setDraftItems((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.indexOf(active.id as string);
      const overIndex = overId in prev ? overItems.length : overItems.indexOf(overId as string);

      activeItems.splice(activeIndex, 1);
      overItems.splice(overIndex >= 0 ? overIndex : overItems.length, 0, active.id as string);

      recentlyMovedToNewContainer.current = true;
      return { ...prev, [activeContainer]: activeItems, [overContainer]: overItems };
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id in draftItems) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const idx = draftItems[activeContainer].indexOf(active.id as string);
      const overIdx = draftItems[overContainer].indexOf(over.id as string);
      if (idx !== overIdx) {
        setDraftItems((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], idx, overIdx),
        }));
      }
      return;
    }

    setDraftItems((prev) => {
      const alreadyMoved =
        !prev[activeContainer].includes(active.id as string) &&
        prev[overContainer].includes(active.id as string);
      if (alreadyMoved) return prev;
      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((i) => i !== active.id),
        [overContainer]: [...prev[overContainer], active.id as string],
      };
    });
  };

  if (loadingBingo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </Box>
    );
  }

  if (bingoError) return <Alert severity="error">{bingoError}</Alert>;

  if (teams.length === 0) {
    return (
      <Alert severity="info">
        No teams found for the active bingo. Set up teams in Bingo Details first.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      {submitError && <Alert severity="error">{submitError}</Alert>}
      {submitSuccess && <Alert severity="success">Teams saved successfully!</Alert>}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Box sx={{ width: { xs: '100%', md: '26%', lg: '20%' }, minWidth: 170 }}>
            <DroppableContainer id="pool" label="Player Pool" items={draftItems['pool'] ?? []}>
              {(draftItems['pool'] ?? []).map((rsn) => (
                <SortableItem key={rsn} id={rsn} />
              ))}
            </DroppableContainer>
          </Box>

          <Grid
            container
            spacing={2}
            sx={{ flex: 1, alignContent: 'flex-start', m: 0, minWidth: 0 }}
          >
            {teams.map((team) => (
              <Grid key={team.id} xs={12} sm={6} lg={4} sx={{ display: 'flex', minWidth: 0 }}>
                <DroppableContainer
                  id={team.id}
                  label={team.name}
                  items={draftItems[team.id] ?? []}
                >
                  {(draftItems[team.id] ?? []).map((rsn) => (
                    <SortableItem key={rsn} id={rsn} />
                  ))}
                </DroppableContainer>
              </Grid>
            ))}
          </Grid>
        </Box>

        <DragOverlay>
          {activeId ? (
            <Chip
              label={String(activeId)}
              sx={{ backgroundColor: '#2A9D8F', color: textPrimary, cursor: 'grabbing' }}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 1 }}>
        {showSubmitButton && (
          <Button
            variant="outlined"
            color="success"
            disabled={submitTeamsDisabled}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            onClick={submitDraft}
            sx={{ width: '25%', ...outlinedButtonSx }}
          >
            {submitting ? 'Saving…' : submitTeamsLabel}
          </Button>
        )}
        {anyTeamHasPlayers && (
          <Button
            variant="outlined"
            color="error"
            onClick={resetDraft}
            sx={{ width: '25%', ...outlinedButtonSx }}
          >
            Reset Teams
          </Button>
        )}
      </Box>
    </Box>
  );
}
