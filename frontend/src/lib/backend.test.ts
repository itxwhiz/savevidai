import { afterEach, expect, test, vi } from "vitest";
import { apiUrl, adminUrl, parseBackendOrigin } from "./backend";
import { proxyUrl } from "./download";
import { resolveTweet } from "./api";
import { sendEvent } from "./analytics";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("same-origin remains the default for Docker and local development", () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  expect(apiUrl("/api/resolve")).toBe("/api/resolve");
  expect(adminUrl("https://site.example")).toBeNull();
});

test("Vercel requires a backend and normalizes its origin", () => {
  expect(() => parseBackendOrigin("", true)).toThrow("VITE_API_BASE_URL");
  expect(parseBackendOrigin(" https://api.example/ ", true)).toBe("https://api.example");
  expect(parseBackendOrigin("http://localhost:8000")).toBe("http://localhost:8000");
});

test.each([
  "not-a-url", "//api.example", "http://api.example", "https://user:pass@api.example",
  "https://api.example/api", "https://api.example?key=secret", "https://api.example#hash",
  "https://*.example", "https://api.example\\path", "https://api.example/..",
])("rejects invalid backend origin %s", (value) => {
  expect(() => parseBackendOrigin(value)).toThrow("VITE_API_BASE_URL");
});

test("Vercel never allows a development HTTP backend", () => {
  expect(() => parseBackendOrigin("http://localhost:8000", true)).toThrow("https");
});

test("resolve, events, media proxy and relative mux all use the backend", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example/");
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response('{"items":[]}', { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await resolveTweet("https://x.com/a/status/123");
  sendEvent("visit");
  expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
    "https://api.example/api/resolve", "https://api.example/api/event",
  ]);
  expect(proxyUrl("https://video.twimg.com/v.mp4", "a b.mp4")).toBe(
    "https://api.example/api/proxy?url=https%3A%2F%2Fvideo.twimg.com%2Fv.mp4&filename=a%20b.mp4",
  );
  expect(proxyUrl("/api/mux/abc12345/720.mp4", "a b.mp4")).toBe(
    "https://api.example/api/mux/abc12345/720.mp4?filename=a%20b.mp4",
  );
  expect(adminUrl("https://frontend.example")).toBe("https://api.example/admin");
  expect(adminUrl("https://api.example")).toBeNull();
});

test.each(["//evil.example/x", "/admin", "/api/../admin", "/api/mux\\evil", "/api/mux/x?y=z"])(
  "does not trust arbitrary site-relative media paths: %s", (value) => {
    expect(() => proxyUrl(value, "video.mp4")).toThrow("media path");
  },
);
