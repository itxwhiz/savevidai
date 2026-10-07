"""Opt-in, exact-origin CORS for a separately hosted frontend."""
import re
from ipaddress import IPv6Address
from urllib.parse import urlsplit


def allowed_origins(value: str) -> list[str]:
    origins = []
    for part in value.split(","):
        raw = part.strip()
        if not raw:
            continue
        try:
            url = urlsplit(raw)
            local = url.hostname in ("localhost", "127.0.0.1", "::1")
            if (
                (url.scheme != "https" and not (local and url.scheme == "http"))
                or not url.hostname or "*" in url.netloc or url.username or url.password
                or not url.hostname.isascii() or "%" in url.hostname
                or url.query or url.fragment or url.path not in ("", "/")
                or not re.fullmatch(r"https?://[^/?#\\\s]+/?", raw)
            ):
                raise ValueError
            # Match the browser's serialized Origin, which omits default ports.
            port = url.port
            host = url.hostname.lower()
            if ":" in host:
                host = f"[{IPv6Address(host).compressed}]"
            if port is not None and port != (443 if url.scheme == "https" else 80):
                host = f"{host}:{port}"
            origins.append(f"{url.scheme}://{host}")
        except ValueError:
            raise ValueError(
                "CORS_ORIGINS must contain comma-separated ASCII https origins, without "
                "wildcards, credentials, paths, queries or fragments. See docs/vercel.md."
            ) from None
    return list(dict.fromkeys(origins))
