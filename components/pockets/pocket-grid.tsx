"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";

import { PocketCard } from "@/components/pockets/pocket-card";
import type { PocketCardModel } from "@/components/pockets/pocket-card";
import { cn } from "@/lib/utils";

type Pocket = PocketCardModel & {
  icon: string | null;
  goalAmount: number;
  order: number;
  isActive: boolean;
};

interface PocketGridProps {
  pockets: Pocket[];
  onReorder: (idsInNewOrder: string[]) => void;
  onEdit?: (pocket: Pocket) => void;
  onDelete?: (pocket: Pocket) => void;
  onView?: (pocket: Pocket) => void;
}

export function PocketGrid({ pockets, onReorder, onEdit, onDelete, onView }: PocketGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const pocketIds = useMemo(() => pockets.map((pocket) => pocket.id), [pockets]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = pockets.findIndex((pocket) => pocket.id === active.id);
      const newIndex = pockets.findIndex((pocket) => pocket.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(pockets, oldIndex, newIndex).map((pocket) => pocket.id);
      onReorder(reordered);
    },
    [onReorder, pockets],
  );

  const handleMove = useCallback(
    (id: string, direction: "up" | "down") => {
      const currentIndex = pockets.findIndex((item) => item.id === id);
      if (currentIndex === -1) return;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= pockets.length) return;

      const reordered = arrayMove(pockets, currentIndex, targetIndex).map((pocket) => pocket.id);
      onReorder(reordered);
    },
    [onReorder, pockets],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pocketIds} strategy={rectSortingStrategy}>
        <div className={cn("grid gap-6", pockets.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1")}>
          {pockets.map((pocket, index) => (
            <SortablePocketCard
              key={pocket.id}
              pocket={pocket}
              index={index}
              total={pockets.length}
              onMoveUp={() => handleMove(pocket.id, "up")}
              onMoveDown={() => handleMove(pocket.id, "down")}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortablePocketCardProps {
  pocket: Pocket;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit?: (pocket: Pocket) => void;
  onDelete?: (pocket: Pocket) => void;
  onView?: (pocket: Pocket) => void;
}

function SortablePocketCard({ pocket, index, total, onMoveUp, onMoveDown, onEdit, onDelete, onView }: SortablePocketCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: pocket.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-pan-y",
        isDragging ? "z-20 cursor-grabbing opacity-90" : "cursor-grab",
      )}
      {...attributes}
      {...listeners}
    >
      <PocketCard
        pocket={pocket}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={index > 0}
        canMoveDown={index < total - 1}
        onEdit={onEdit ? (cardPocket) => onEdit({ ...pocket, ...cardPocket }) : undefined}
        onDelete={onDelete ? (cardPocket) => onDelete({ ...pocket, ...cardPocket }) : undefined}
        onView={onView ? (cardPocket) => onView({ ...pocket, ...cardPocket }) : undefined}
      />
    </div>
  );
}
