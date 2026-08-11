"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ScrollContainerStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
};

function createScrollContainerStore(): ScrollContainerStore {
  let node: HTMLElement | null = null;
  const listeners = new Set<() => void>();

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSnapshot() {
      return node;
    },
    setNode(next) {
      if (node === next) return;
      node = next;
      for (const listener of listeners) listener();
    },
  };
}

const ScrollContainerContext = createContext<ScrollContainerStore | null>(null);

const EMPTY_SUBSCRIBE = () => () => {};
const NO_NODE = () => null;

/**
 * The element the app actually scrolls.
 *
 * Published through a store rather than looked up by selector: the node does
 * not exist on the first render, and a `querySelector` has no way to tell a
 * consumer when it appears — nor which shell it belongs to when a route
 * transition briefly mounts two. Consumers get `null` until it is real, which
 * forces them to handle that case instead of silently falling back to
 * `window` and appearing to work.
 */
export function useScrollContainer(): HTMLElement | null {
  const store = useContext(ScrollContainerContext);

  return useSyncExternalStore(
    store?.subscribe ?? EMPTY_SUBSCRIBE,
    store?.getSnapshot ?? NO_NODE,
    NO_NODE,
  );
}

export function ShellScrollProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createScrollContainerStore);

  return (
    <ScrollContainerContext.Provider value={store}>
      {children}
    </ScrollContainerContext.Provider>
  );
}

/**
 * The single scroll region inside the app shell.
 *
 * Everything outside it — the top bar, the drawer, overlays — is chrome that
 * cannot scroll, which is what makes the shell feel like an app rather than a
 * document.
 */
export function ShellScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const store = useContext(ScrollContainerContext);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const setNode = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      store?.setNode(node);
    },
    [store],
  );

  // App Router resets scroll with `window.scrollTo`, which does nothing once
  // the document is locked — and this node lives in the layout, so React keeps
  // it across navigations. Without this you arrive at the previous route's
  // offset. Layout effect, or the old offset paints for a frame first.
  useLayoutEffect(() => {
    nodeRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <div
      ref={setNode}
      data-slot="shell-scroll"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
        className,
      )}
    >
      {children}
    </div>
  );
}
