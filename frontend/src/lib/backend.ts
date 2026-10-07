/** Public backend origin only. VITE_* values are included in browser bundles. */
export function parseBackendOrigin(value: string | undefined, hosted = false): string {
  const raw = value?.trim() ?? "";
  if (!raw && !hosted) return "";
  const message = "VITE_API_BASE_URL must be your backend's https origin (no path, credentials, query or fragment). See the deployment guides in README.md.";
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && !hosted && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.hostname.includes("*") ||
      // Check the raw input too: URL normalizes backslashes and dot segments.
      !/^https?:\/\/[^/?#\\]+\/?$/.test(raw)
    ) throw new Error(message);
    return url.origin;
  } catch {
    throw new Error(message);
  }
}

export function apiUrl(path: string): string {
  return `${parseBackendOrigin(import.meta.env.VITE_API_BASE_URL)}${path}`;
}

/** Keep the Secure, SameSite=Strict admin cookie on the backend's own origin. */
export function adminUrl(currentOrigin: string): string | null {
  const origin = parseBackendOrigin(import.meta.env.VITE_API_BASE_URL);
  return origin && origin !== currentOrigin ? `${origin}/admin` : null;
}
