"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField } from "../../lib/form-builder";

type NewFieldData = { kind: "new"; type: FieldType };

type BuilderDndValue = {
  /** Where a field type dragged from the palette would land, while it is over the form. */
  dropIndex: number | null;
  registerCard: (fieldId: string, element: HTMLElement | null) => void;
  registerCanvas: (element: HTMLElement | null) => void;
  /** True right after a drop, so the click that ends a drag does not also add a field. */
  justDropped: () => boolean;
};

const BuilderDndContext = createContext<BuilderDndValue | null>(null);

function useBuilderDnd(): BuilderDndValue {
  const value = useContext(BuilderDndContext);
  if (!value) throw new Error("useBuilderDnd must be used inside BuilderDnd");
  return value;
}

/** Where a field type dragged from the palette will land; it takes up room so the cards make space. */
export function DropSlot({ index }: { index: number }) {
  const t = useTranslations("FormsPage.builder");
  const { dropIndex } = useBuilderDnd();
  if (dropIndex !== index) return null;
  return (
    <div
      className="flex h-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-medium text-primary"
      aria-hidden
    >
      {t("dropHere")}
    </div>
  );
}

/** The form area a field type can be dropped on; dropping outside it adds nothing. */
export function BuilderCanvas({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: ReactNode;
}) {
  const { registerCanvas } = useBuilderDnd();
  return (
    <section ref={registerCanvas} aria-label={label} className={className}>
      {children}
    </section>
  );
}

// A new field is not in the list yet, so the cards stay put and a line shows where it lands.
const KEEP_IN_PLACE: SortingStrategy = () => null;

function isNewField(data: unknown): data is NewFieldData {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as NewFieldData).kind === "new"
  );
}

type Props = {
  fields: BuilderField[];
  onMove: (fieldId: string, toIndex: number) => void;
  onInsert: (type: FieldType, index: number) => void;
  children: ReactNode;
};

/** Reorders field cards by their grip, and drops field types dragged from the palette into the form. */
export function BuilderDnd({ fields, onMove, onInsert, children }: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [newType, setNewType] = useState<FieldType | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const canvas = useRef<HTMLElement | null>(null);
  const droppedAt = useRef(0);

  const ids = useMemo(() => fields.map((field) => field.id), [fields]);

  const registerCard = useCallback(
    (fieldId: string, element: HTMLElement | null) => {
      if (element) cards.current.set(fieldId, element);
      else cards.current.delete(fieldId);
    },
    [],
  );
  const registerCanvas = useCallback((element: HTMLElement | null) => {
    canvas.current = element;
  }, []);
  const justDropped = useCallback(
    () => performance.now() - droppedAt.current < 400,
    [],
  );
  const value = useMemo<BuilderDndValue>(
    () => ({ dropIndex, registerCard, registerCanvas, justDropped }),
    [dropIndex, registerCard, registerCanvas, justDropped],
  );

  function labelOf(fieldId: UniqueIdentifier) {
    const field = fields.find((f) => f.id === fieldId);
    return field?.label.trim() || t("untitled");
  }

  function positionOf(fieldId: UniqueIdentifier) {
    return ids.indexOf(String(fieldId)) + 1;
  }

  function insertionIndex(event: DragMoveEvent): number | null {
    const start = event.activatorEvent;
    const area = canvas.current?.getBoundingClientRect();
    if (!(start instanceof PointerEvent) || !area) return null;
    const x = start.clientX + event.delta.x;
    const y = start.clientY + event.delta.y;
    if (x < area.left || x > area.right || y < area.top || y > area.bottom)
      return null;

    let index = 0;
    for (const fieldId of ids) {
      const rect = cards.current.get(fieldId)?.getBoundingClientRect();
      if (rect && y > rect.top + rect.height / 2) index += 1;
    }
    return index;
  }

  function reset() {
    setNewType(null);
    setDropIndex(null);
    droppedAt.current = performance.now();
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (isNewField(data)) setNewType(data.type);
  }

  function handleDragMove(event: DragMoveEvent) {
    if (isNewField(event.active.data.current))
      setDropIndex(insertionIndex(event));
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current;
    if (isNewField(data)) {
      if (dropIndex !== null) onInsert(data.type, dropIndex);
    } else if (event.over && event.over.id !== event.active.id) {
      const to = ids.indexOf(String(event.over.id));
      if (to !== -1) onMove(String(event.active.id), to);
    }
    reset();
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      isNewField(active.data.current)
        ? undefined
        : t("dnd.pickedUp", {
            label: labelOf(active.id),
            position: positionOf(active.id),
            count: ids.length,
          }),
    onDragOver: ({ active, over }) =>
      over && !isNewField(active.data.current)
        ? t("dnd.movedTo", {
            label: labelOf(active.id),
            position: positionOf(over.id),
            count: ids.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over && !isNewField(active.data.current)
        ? t("dnd.dropped", {
            label: labelOf(active.id),
            position: positionOf(over.id),
            count: ids.length,
          })
        : undefined,
    onDragCancel: ({ active }) =>
      isNewField(active.data.current)
        ? undefined
        : t("dnd.cancelled", { label: labelOf(active.id) }),
  };

  const OverlayIcon = newType ? FIELD_TYPE_ICONS[newType] : null;

  return (
    <BuilderDndContext.Provider value={value}>
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("dnd.instructions") },
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
      >
        <SortableContext
          items={ids}
          strategy={newType ? KEEP_IN_PLACE : verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {newType && OverlayIcon ? (
            <div className="inline-flex h-10 cursor-grabbing items-center gap-2 rounded-lg bg-popover px-3.5 text-sm font-medium shadow-lg ring-1 ring-foreground/10">
              <OverlayIcon className="size-4" aria-hidden />
              {tForms(`fieldTypes.${newType}`)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </BuilderDndContext.Provider>
  );
}

/** Pointer-only: Enter and Space on a palette button keep adding the field rather than starting a drag. */
export function usePaletteDrag(
  type: FieldType,
  placement: "palette" | "end",
  disabled: boolean,
) {
  const { justDropped } = useBuilderDnd();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `new-${placement}-${type}`,
    data: { kind: "new", type } satisfies NewFieldData,
    disabled,
  });
  const onPointerDown = listeners?.onPointerDown as
    ((event: ReactPointerEvent<HTMLElement>) => void) | undefined;
  return { nodeRef: setNodeRef, onPointerDown, isDragging, justDropped };
}

export function useSortableField(fieldId: string) {
  const { registerCard } = useBuilderDnd();
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fieldId });

  const nodeRef = useCallback(
    (element: HTMLElement | null) => {
      setNodeRef(element);
      registerCard(fieldId, element);
    },
    [fieldId, registerCard, setNodeRef],
  );

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return {
    nodeRef,
    handleRef: setActivatorNodeRef,
    handleProps: { ...attributes, ...listeners },
    style,
    isDragging,
  };
}
