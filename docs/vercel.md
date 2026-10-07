# Vercel deployment

For the zero-dollar hobby path, start with [Cloudflare Pages + Render Free](free-hosting.md).
Vercel remains an alternative frontend host using the same backend contract.

This setup deploys the React/Vite frontend on Vercel. The FastAPI media backend
must run separately using this repository's Dockerfile (on a Docker-capable host
or your own VPS). A Vercel frontend by itself cannot resolve or download videos.

The backend streams large files, uses temporary disk plus ffmpeg to combine
Reddit video and audio, and has process-local rate limits, maintenance state and
an analytics flush thread. It is not a drop-in stateless Vercel Function. This
configuration deliberately sends API calls and media bytes directly to your
backend instead of buffering videos through Vercel Functions or CDN rewrites.
The existing all-in-one Docker deployment still works without any new variables.

## 1. Run your backend

Build the Dockerfile from the repository root and run it on a host that supports
long-lived HTTP streaming, temporary disk and ffmpeg. The image already includes
ffmpeg and a same-origin frontend for the admin dashboard.

```sh
docker build -t savevidai .
docker run --rm -p 8000:8000 \
  -e CORS_ORIGINS=https://your-project.vercel.app \
  savevidai
```

Put the backend behind HTTPS using your host's domain or a reverse proxy. Do not
use the upstream maintainer's live backend. Use a single backend worker/replica
with the existing process-local rate limiting and maintenance toggle; multiple
workers need shared state before they offer consistent limits or maintenance.
Configure the hosting ingress to sanitize client-IP forwarding headers.

Confirm `https://YOUR_BACKEND/api/health` returns `{"ok":true,"ffmpeg":true}`.
All downloader platforms use public third-party metadata/CDN services and remain
subject to their availability and access restrictions. Only download media you
have the right to download; this setup does not bypass login, paywalls or DRM.

Backend environment variables:

- `CORS_ORIGINS`: comma-separated exact frontend origins, for example
  `https://your-project.vercel.app,https://videos.example.com`. No paths, wildcards,
  credentials, query strings or fragments. Empty means cross-origin access is
  disabled. Invalid values stop startup with an actionable error.
  Use the browser's ASCII/punycode hostname for internationalized domains.
- Existing optional analytics and Reddit credentials stay on the backend only.
  None are needed for a basic frontend deployment. See the README for analytics.
- `MAINTENANCE_MODE=1` continues to stop public backend API requests. With this
  split deployment the Vercel page remains visible and shows the API maintenance
  error after a request. The backend flag does not replace Vercel's static HTML.

CORS is a browser policy, not authentication or a firewall. Public endpoints still
need the existing URL allowlists, rate limits and host-level abuse protection.
The frontend never needs cross-origin cookies; the backend does not enable them.

## 2. Import into Vercel

Import your repository into Vercel and use these settings:

- Root Directory: repository root, not `frontend`
- Framework Preset: Vite
- Node.js: 22.x
- Install Command: `npm ci --prefix frontend`
- Build Command: `npm --prefix frontend run build:vercel`
- Output Directory: `frontend/dist`

The root `vercel.json` supplies the build settings. It enables clean URLs for
the existing multi-page build: `/`, `/tiktokvideodownloader`,
`/redditvideodownloader` and `/admin`. There is no catch-all SPA rewrite that
would hide a missing page or return HTML for an API request.

Before building, set `VITE_API_BASE_URL=https://YOUR_BACKEND` in Vercel for each
environment you intend to deploy. It must be an HTTPS origin with no path or
credentials. A missing or invalid value fails `build:vercel` instead of producing
a silently broken site. This URL is public and is embedded in the JS bundle.
Never put API keys, passwords, database URLs or tokens in a `VITE_*` variable.

Redeploy after changing this build-time variable. Set the backend's
`CORS_ORIGINS` to include the actual frontend origin and restart the backend.
For previews, use a stable branch preview origin or explicitly add each trusted
preview URL. Do not allow `*.vercel.app`: it includes other people's projects.
Use a separate test backend for untrusted pull-request previews.

The Vercel `/admin` page sends you to `https://YOUR_BACKEND/admin`. Login and all
admin actions happen there with the existing Secure, SameSite=Strict cookie.
Do not weaken the cookie settings to make third-party cookies work. Keep the
backend image's frontend build in normal same-origin mode, without
`VITE_API_BASE_URL`, so admin does not redirect back to Vercel.

Before a public launch, update the canonical URLs, Open Graph URLs and sitemap
in `frontend/*.html` and `frontend/public/` to your own domain. The repository
retains the upstream site's attribution and metadata until you choose a domain.

## 3. Verify

```sh
# Local quality gates
cd backend
python3.12 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
ruff check .
pytest -q
cd ../frontend
npm ci
npm run lint
npm test -- --run
VITE_API_BASE_URL=https://YOUR_BACKEND npm run build:vercel
```

For local split-origin testing, set `VITE_API_BASE_URL=http://localhost:8000`
in `frontend/.env.local`, run the backend with
`CORS_ORIGINS=http://localhost:5173`, and run `npm run dev`. HTTP is accepted
only for explicit loopback development origins, never by `build:vercel`.

After deploying:

1. Open all four clean page URLs directly and refresh them. `/admin` should land
   on your backend and its login should work there if analytics is enabled.
2. In browser Network tools, resolve a public post you own. `/api/resolve` and
   `/api/event` must target your backend, with no CORS or mixed-content errors.
3. Download a Twitter/TikTok video or photo, and a Reddit clip with audio. Proxy
   and mux requests must target your backend directly; check progress, filenames
   and audio. Test a video larger than 4.5 MB so a small-file-only smoke test
   cannot mask an accidental function proxy.
4. Confirm invalid/unsupported URLs fail clearly, and an unlisted browser origin
   does not receive `Access-Control-Allow-Origin`.
5. Check maintenance behavior, restore it, and verify `/api/health` stays healthy.

This change does not create hosting accounts, purchase services, configure DNS,
enable analytics, provision credentials or deploy the app. Actual hosting costs,
service limits and third-party extraction behavior need verification on your
chosen backend host and Vercel account.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[vercel.json](https://vercel.com/docs/project-configuration/vercel-json),
[Vercel Function limits](https://vercel.com/docs/functions/limitations),
[FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/).
