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

type SlotName = "title" | "center" | "actions";

type SlotTargets = Partial<Record<SlotName, HTMLElement | null>>;

type MobileHeaderSlotContextValue = {
  targets: SlotTargets;
  setTarget: (name: SlotName, node: HTMLElement | null) => void;
};

const MobileHeaderSlotContext =
  createContext<MobileHeaderSlotContextValue | null>(null);

export function MobileHeaderSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<SlotTargets>({});

  const setTarget = useCallback((name: SlotName, node: HTMLElement | null) => {
    setTargets((previous) =>
      previous[name] === node ? previous : { ...previous, [name]: node },
    );
  }, []);

  const value = useMemo(() => ({ targets, setTarget }), [targets, setTarget]);

  return (
    <MobileHeaderSlotContext.Provider value={value}>
      {children}
    </MobileHeaderSlotContext.Provider>
  );
}

/** Callback ref for the top bar to publish one of its slot containers. */
export function useMobileHeaderSlotRef(name: SlotName) {
  const context = useContext(MobileHeaderSlotContext);
  const setTarget = context?.setTarget;

  return useCallback(
    (node: HTMLElement | null) => {
      setTarget?.(name, node);
    },
    [name, setTarget],
  );
}

function MobileHeaderSlot({
  name,
  children,
}: {
  name: SlotName;
  children: ReactNode;
}) {
  const context = useContext(MobileHeaderSlotContext);
  const target = context?.targets[name] ?? null;

  return target ? createPortal(children, target) : null;
}

export function MobileHeaderTitle({ children }: { children: ReactNode }) {
  return <MobileHeaderSlot name="title">{children}</MobileHeaderSlot>;
}

export function MobileHeaderCenter({ children }: { children: ReactNode }) {
  return <MobileHeaderSlot name="center">{children}</MobileHeaderSlot>;
}

export function MobileHeaderActions({ children }: { children: ReactNode }) {
  return <MobileHeaderSlot name="actions">{children}</MobileHeaderSlot>;
}
