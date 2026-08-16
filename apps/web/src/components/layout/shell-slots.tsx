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
