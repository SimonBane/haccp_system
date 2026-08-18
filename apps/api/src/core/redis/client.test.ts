import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = vi.hoisted(() => ({
  isOpen: false,
  isReady: false,
  connect: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
}));

vi.mock("redis", () => ({
  createClient: vi.fn(() => mockClient),
}));

const { withRedis } = await import("./client.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.isOpen = false;
  mockClient.isReady = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withRedis", () => {
  it("resolves with the command result when the client is ready", async () => {
    mockClient.isReady = true;
    const fn = vi.fn(async () => "ok");

    await expect(withRedis(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledWith(mockClient);
  });

  it("rejects immediately when the client is not ready, without waiting on a connect attempt", async () => {
    mockClient.isReady = false;
    mockClient.isOpen = false;
    // The fire-and-forget reconnect nudge must never be awaited by withRedis.
    mockClient.connect.mockImplementation(() => new Promise(() => {}));

    const fn = vi.fn();
    const start = Date.now();

    await expect(withRedis(fn)).rejects.toThrow("Redis client is not ready");

    expect(Date.now() - start).toBeLessThan(50);
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects once the command timeout elapses if the command never resolves", async () => {
    vi.useFakeTimers();
    mockClient.isReady = true;
    const fn = vi.fn(() => new Promise(() => {}));

    const assertion = expect(withRedis(fn)).rejects.toThrow(
      "Redis command timed out",
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
