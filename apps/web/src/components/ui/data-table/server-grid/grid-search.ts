export const GRID_SEARCH_DEBOUNCE_MS = 350;

export type SearchCommitter = {
  push: (value: string) => void;
  cancel: () => void;
};

/**
 * Typing is debounced; clearing commits at once so the full list comes back
 * immediately. `cancel` exists so an unmounting component drops its pending timer.
 */
export function createSearchCommitter(options: {
  onCommit: (value: string) => void;
  delayMs?: number;
}): SearchCommitter {
  const delayMs = options.delayMs ?? GRID_SEARCH_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    push(value: string) {
      cancel();

      if (value.trim() === "") {
        options.onCommit("");
        return;
      }

      timer = setTimeout(() => {
        timer = undefined;
        options.onCommit(value);
      }, delayMs);
    },
    cancel,
  };
}
