import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

type ContainerId = string;

export type ContainersState = Record<ContainerId, string[]>;

export type UseTeamDrafterReturn = {
  containers: ContainersState;
  setContainers: (updater: (prev: ContainersState) => ContainersState) => void;
  activeId: string | null;
  sensors: ReturnType<typeof useSensors>;
  Dnd: ({ children }: { children: React.ReactNode }) => JSX.Element;
  getContainerIds: () => ContainerId[];
};

/**
 * Hook implementing a multi-container, many-items sortable setup inspired by
 * the dnd-kit multiple containers example.
 */
export function useTeamDrafter(): UseTeamDrafterReturn {
  const initialContainers = useMemo<ContainersState>(() => {
    return {
      pool: Array.from({ length: 24 }, (_, i) => `player-${i + 1}`),
      teamA: [],
      teamB: [],
      teamC: [],
    };
  }, []);

  const [containersState, setContainersState] = useState<ContainersState>(initialContainers);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainerIdForItem = useCallback(
    (id: string): ContainerId | undefined => {
      return Object.keys(containersState).find((containerId) =>
        containersState[containerId].includes(id),
      );
    },
    [containersState],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeContainer = findContainerIdForItem(String(active.id));
      const overContainer = containersState[String(over.id)]
        ? String(over.id)
        : findContainerIdForItem(String(over.id));

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return;
      }

      setContainersState((prev) => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        const activeIndex = activeItems.indexOf(String(active.id));

        const newActive = [...activeItems];
        newActive.splice(activeIndex, 1);

        const overIndex = overItems.indexOf(String(over.id));
        const newOver = [...overItems];
        const insertIndex = overIndex >= 0 ? overIndex + 1 : newOver.length;
        newOver.splice(insertIndex, 0, String(active.id));

        return {
          ...prev,
          [activeContainer]: newActive,
          [overContainer]: newOver,
        };
      });
    },
    [containersState, findContainerIdForItem],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeContainer = findContainerIdForItem(String(active.id));
      const overContainer = findContainerIdForItem(String(over.id));

      if (!activeContainer || !overContainer) return;

      if (activeContainer === overContainer) {
        const items = containersState[activeContainer];
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        if (oldIndex !== newIndex) {
          setContainersState((prev) => ({
            ...prev,
            [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
          }));
        }
      }
    },
    [containersState, findContainerIdForItem],
  );

  const Dnd = useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {children}
      </DndContext>
    ),
    [onDragEnd, onDragOver, onDragStart, sensors],
  );

  const getContainerIds = useCallback(() => Object.keys(containersState), [containersState]);

  const setContainers = useCallback((updater: (prev: ContainersState) => ContainersState) => {
    setContainersState((prev) => updater(prev));
  }, []);

  return {
    containers: containersState,
    setContainers,
    activeId,
    sensors,
    Dnd,
    getContainerIds,
  };
}

export function Containers({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  return <SortableContext items={ids}>{children}</SortableContext>;
}
