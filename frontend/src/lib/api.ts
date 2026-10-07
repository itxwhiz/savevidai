import { apiUrl } from "./backend";

export type Variant = {
  label: string;
  width: number | null;
  height: number | null;
  url: string;
  size_bytes: number | null;
};

export type MediaItem = {
  index: number;
  kind: "video" | "gif" | "image" | "audio";
  thumbnail: string | null;
  duration_seconds: number | null;
  variants: Variant[];
};

export type ResolveResponse = {
  id: string;
  author: string;
  handle: string;
  avatar_url: string | null;
  text: string;
  items: MediaItem[];
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function resolveTweet(url: string, signal?: AbortSignal): Promise<ResolveResponse> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  // Free container hosts can take about a minute to wake. Bound a single
  // user-initiated request; never poll or send traffic to prevent idle sleep.
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(apiUrl("/api/resolve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const fallback = res.status >= 500
        ? "the server may be waking up or unavailable. try again in about a minute."
        : "Something went wrong. Try again.";
      throw new ApiError(body?.error ?? "upstream_error", body?.message ?? fallback);
    }
    // Some hosting wake-up pages return HTML with 200. Never treat that as media.
    if (!body || !Array.isArray(body.items)) {
      throw new ApiError("server_unavailable", "the server may be waking up. try again in about a minute.");
    }
    return body as ResolveResponse;
  } catch (err) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ApiError("server_timeout", "the server took too long to respond. try again in a minute; if it keeps failing, it may be offline or out of its free allowance.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
