import { afterEach, expect, test, vi } from "vitest";
import { ApiError, resolveTweet } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("returns parsed body on 200", async () => {
  const body = { id: "20", author: "Jack", handle: "jack", avatar_url: null, text: "", items: [] };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
  await expect(resolveTweet("https://x.com/jack/status/20")).resolves.toEqual(body);
});

test("throws ApiError with server code on 4xx", async () => {
  const err = { error: "no_video", message: "This post has no video." };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(err), { status: 422 })));
  const p = resolveTweet("https://x.com/jack/status/20");
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await expect(p).rejects.toMatchObject({ code: "no_video" });
});

test("throws generic ApiError on non-JSON failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 })));
  await expect(resolveTweet("x")).rejects.toMatchObject({ code: "upstream_error" });
});

test("a hosting wake-up HTML page is a retryable error, never resolved media", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>starting</html>", { status: 200 })));
  await expect(resolveTweet("x")).rejects.toMatchObject({ code: "server_unavailable" });
});

test("cold starts are allowed time, but a stalled resolve is aborted after 90 seconds", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
    signal = init.signal;
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })));
  const result = expect(resolveTweet("x")).rejects.toMatchObject({ code: "server_timeout" });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(30_000);
  await result;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
