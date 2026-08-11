"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const ACTIVATION_PX = 8;
const AXIS_RATIO = 1.2;
/** Fraction of the action tray past which a slow release settles open. */
const SNAP_RATIO = 0.4;
/** px/ms — a flick this fast wins regardless of distance. */
const SNAP_VELOCITY = 0.35;
const VELOCITY_WINDOW_MS = 80;

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  axis: "none" | "x";
  moved: boolean;
  samples: { x: number; t: number }[];
};

/**
 * Swipe a list row left to reveal its actions.
 *
 * Direction is what keeps this from fighting the navigation drawer: the drawer
 * only claims *rightward* drags while it is closed, so leftward drags arrive
 * here untouched. Once this row is open it marks itself `data-no-swipe`, so
 * the rightward drag that closes it is not taken by the drawer either.
 *
 * Swipe is not reachable by keyboard or screen reader, so every row that uses
 * this must keep an equivalent overflow menu.
 */
export function SwipeableRow({
  children,
  actions,
  actionsWidth = 152,
  onOpenChange,
  className,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
  /** Width of the action tray in px. */
  actionsWidth?: number;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const offsetRef = React.useRef(0);
  const frameRef = React.useRef(0);
  const pendingRef = React.useRef(0);
  const [open, setOpen] = React.useState(false);

  const write = React.useCallback((value: number) => {
    offsetRef.current = value;
    pendingRef.current = value;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const node = contentRef.current;
      if (node) node.style.translate = `${pendingRef.current}px`;
    });
  }, []);

  const settle = React.useCallback(
    (next: boolean) => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      offsetRef.current = next ? -actionsWidth : 0;
      const node = contentRef.current;
      if (node) {
        node.removeAttribute("data-swiping");
        void node.offsetWidth;
        node.style.translate = `${offsetRef.current}px`;
      }
      setOpen((previous) => {
        if (previous !== next) onOpenChange?.(next);
        return next;
      });
    },
    [actionsWidth, onOpenChange],
  );

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "mouse") return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offsetRef.current,
        axis: "none",
        moved: false,
        samples: [{ x: event.clientX, t: event.timeStamp }],
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > ACTIVATION_PX) drag.moved = true;

      if (drag.axis === "none") {
        if (Math.abs(dx) < ACTIVATION_PX) return;
        if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;
        // Closed rows only take leftward drags; rightward belongs to the
        // drawer. Open rows take rightward drags to close themselves.
        if (drag.startOffset === 0 && dx > 0) {
          dragRef.current = null;
          return;
        }
        drag.axis = "x";
        drag.samples.length = 0;
        contentRef.current?.setAttribute("data-swiping", "");
      }

      drag.samples.push({ x: event.clientX, t: event.timeStamp });
      if (drag.samples.length > 12) drag.samples.shift();

      const adjusted = dx - Math.sign(dx) * ACTIVATION_PX;
      write(
        Math.max(-actionsWidth, Math.min(0, drag.startOffset + adjusted)),
      );
    };

    const finish = (event: PointerEvent, cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      if (drag.axis !== "x") {
        contentRef.current?.removeAttribute("data-swiping");
        return;
      }

      if (cancelled) {
        settle(drag.startOffset !== 0);
        return;
      }

      const now = event.timeStamp;
      const recent = drag.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
      const first = recent[0] ?? drag.samples[0];
      const elapsed = Math.max(now - (first?.t ?? now), 1);
      const velocity = (event.clientX - (first?.x ?? event.clientX)) / elapsed;

      settle(
        Math.abs(velocity) > SNAP_VELOCITY
          ? velocity < 0
          : Math.abs(offsetRef.current) > actionsWidth * SNAP_RATIO,
      );
    };

    const onPointerUp = (event: PointerEvent) => finish(event, false);
    const onPointerCancel = (event: PointerEvent) => finish(event, true);

    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerup", onPointerUp, { passive: true });
    root.addEventListener("pointercancel", onPointerCancel, { passive: true });

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [actionsWidth, settle, write]);

  return (
    <div
      ref={rootRef}
      data-slot="swipeable-row"
      // While open, the drawer must not take the rightward swipe that closes
      // this row.
      data-no-swipe={open ? "" : undefined}
      className={cn("relative overflow-hidden", className)}
    >
      <div
        aria-hidden={!open}
        className="absolute inset-y-0 end-0 flex items-stretch"
        style={{ width: actionsWidth }}
      >
        {actions}
      </div>

      <div
        ref={contentRef}
        data-slot="swipeable-row-content"
        className="relative bg-card transition-[translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[swiping]:transition-none"
        onClickCapture={(event) => {
          // An open row swallows the next tap to close instead of activating.
          if (!open) return;
          event.preventDefault();
          event.stopPropagation();
          settle(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
