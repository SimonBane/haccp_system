"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Named regions of the app shell that a page can render into from anywhere in
 * its tree.
 *
 * `title` / `center` / `actions` are the mobile top bar. `overlay` is the
 * layer above the scroll region inside the content panel — floating controls
 * belong there rather than `position: fixed`, which on mobile resolves against
 * the drawer-transformed panel and drifts with it.
 */
type SlotName = "title" | "center" | "actions" | "overlay";

type SlotTargets = Partial<Record<SlotName, HTMLElement | null>>;

type ShellSlotContextValue = {
  targets: SlotTargets;
  setTarget: (name: SlotName, node: HTMLElement | null) => void;
};

const ShellSlotContext = createContext<ShellSlotContextValue | null>(null);

export function ShellSlotProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<SlotTargets>({});

  const setTarget = useCallback((name: SlotName, node: HTMLElement | null) => {
    setTargets((previous) =>
      previous[name] === node ? previous : { ...previous, [name]: node },
    );
  }, []);

  const value = useMemo(() => ({ targets, setTarget }), [targets, setTarget]);

  return (
    <ShellSlotContext.Provider value={value}>
      {children}
    </ShellSlotContext.Provider>
  );
}

/** Callback ref for the shell to publish one of its slot containers. */
export function useShellSlotRef(name: SlotName) {
  const context = useContext(ShellSlotContext);
  const setTarget = context?.setTarget;

  return useCallback(
    (node: HTMLElement | null) => {
      setTarget?.(name, node);
    },
    [name, setTarget],
  );
}

function ShellSlot({
  name,
  children,
}: {
  name: SlotName;
  children: ReactNode;
}) {
  const context = useContext(ShellSlotContext);
  const target = context?.targets[name] ?? null;

  return target ? createPortal(children, target) : null;
}

export function MobileHeaderTitle({ children }: { children: ReactNode }) {
  return <ShellSlot name="title">{children}</ShellSlot>;
}

export function MobileHeaderCenter({ children }: { children: ReactNode }) {
  return <ShellSlot name="center">{children}</ShellSlot>;
}

export function MobileHeaderActions({ children }: { children: ReactNode }) {
  return <ShellSlot name="actions">{children}</ShellSlot>;
}

export function ShellOverlay({ children }: { children: ReactNode }) {
  return <ShellSlot name="overlay">{children}</ShellSlot>;
}

/**
 * Host for `ShellOverlay` content. Rendered as a sibling of the scroll region
 * so its children are positioned against the content panel, and stay put while
 * the region scrolls under them.
 */
export function ShellOverlaySlot() {
  const ref = useShellSlotRef("overlay");

  return (
    <div
      ref={ref}
      data-slot="shell-overlay"
      className="pointer-events-none absolute inset-0 z-40"
    />
  );
}
