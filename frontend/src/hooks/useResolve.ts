import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, resolveTweet, type ResolveResponse } from "../lib/api";

export type ResolveState =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "ready"; data: ResolveResponse }
  | { status: "error"; code: string; message: string };

export function useResolve() {
  const [state, setState] = useState<ResolveState>({ status: "idle" });
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  const resolve = useCallback(async (url: string) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ status: "resolving" });
    try {
      const data = await resolveTweet(url, controller.signal);
      if (active.current !== controller || controller.signal.aborted) return;
      setState({ status: "ready", data });
    } catch (err) {
      if (active.current !== controller || controller.signal.aborted) return;
      if (err instanceof ApiError) {
        setState({ status: "error", code: err.code, message: err.message });
      } else {
        setState({
          status: "error",
          code: "network",
          message: "can't reach the server. it may be waking up or unavailable. check your connection and try again in about a minute.",
        });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, resolve, reset };
}
