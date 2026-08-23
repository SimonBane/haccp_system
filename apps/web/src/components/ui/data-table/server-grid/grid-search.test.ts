import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSearchCommitter, GRID_SEARCH_DEBOUNCE_MS } from "./grid-search";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSearchCommitter", () => {
  it("waits out the debounce before committing", () => {
    const onCommit = vi.fn();
    const committer = createSearchCommitter({ onCommit });

    committer.push("fri");
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(GRID_SEARCH_DEBOUNCE_MS - 1);
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("fri");
  });

  it("commits only the last keystroke of a burst", () => {
    const onCommit = vi.fn();
    const committer = createSearchCommitter({ onCommit });

    committer.push("f");
    vi.advanceTimersByTime(100);
    committer.push("fr");
    vi.advanceTimersByTime(100);
    committer.push("fri");
    vi.advanceTimersByTime(GRID_SEARCH_DEBOUNCE_MS);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("fri");
  });

  it("commits a clear immediately", () => {
    const onCommit = vi.fn();
    const committer = createSearchCommitter({ onCommit });

    committer.push("fridge");
    committer.push("");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("");
  });

  it("treats whitespace as a clear and cancels the pending term", () => {
    const onCommit = vi.fn();
    const committer = createSearchCommitter({ onCommit });

    committer.push("fridge");
    committer.push("   ");
    vi.advanceTimersByTime(GRID_SEARCH_DEBOUNCE_MS * 2);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("");
  });

  it("drops a pending commit when cancelled", () => {
    const onCommit = vi.fn();
    const committer = createSearchCommitter({ onCommit });

    committer.push("fridge");
    committer.cancel();
    vi.advanceTimersByTime(GRID_SEARCH_DEBOUNCE_MS * 2);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("is safe to cancel more than once", () => {
    const committer = createSearchCommitter({ onCommit: vi.fn() });
    expect(() => {
      committer.cancel();
      committer.cancel();
    }).not.toThrow();
  });
});
