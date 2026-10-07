# Free hobby hosting: Cloudflare Pages + Render

This is the recommended starting path for a zero-dollar, light-personal-use
setup. Cloudflare Pages serves the frontend. Render Free runs this repository's
Docker backend with Python and ffmpeg. This is a split deployment, not a fully
Cloudflare-hosted service. Pages alone cannot run the existing ffmpeg backend.

No account, deployment, payment method or paid resource is created by these
files. Review both providers' current limits and terms before you deploy.

## Cost and availability limits

As checked on October 7, 2026, Render Hobby includes 5 GB/month outbound bandwidth.
Video responses consume it: 5 GB is roughly 100 downloads of 50 MB, before other
traffic. That is an estimate, not an enforced app quota.
[Render pricing](https://render.com/pricing)

Render Free sleeps after 15 idle minutes and usually needs about a minute to
wake. Its 750 monthly instance hours are shared across a workspace. Exceeding
hours suspends free services. With no payment method, excess bandwidth suspends
free services for the month; exhausted build minutes block new builds. If a
payment method is present, overages can be billed. Render may separately suspend
services with unusually high outbound-initiated internet traffic, which matters
for this downloader's API calls and media fetching. Such suspension may require
a paid upgrade to restore. This free setup cannot promise to remain available
for a busy public downloader.
[Render free-service limitations](https://render.com/docs/free)

For a strict $0 budget:

- Choose the free workspace and free compute instance, and do not add a payment
  method. If your existing workspace has one, review billing before deploying;
  the `free` instance setting alone is not a hard zero-spend guarantee.
- Do not add databases, disks, Workers Paid, Cloudflare Containers, storage,
  custom-domain purchases or other paid extras. Use the included provider URLs.
- Accept suspension when free allowances run out. Do not upgrade automatically.
- Do not add uptime pings, scheduled warmers or automated retry loops to keep the
  backend awake. The app waits only for user-initiated work.
- Watch usage in the provider dashboards. CORS is not access control, and the
  publicly reachable backend can receive traffic from people other than you.

## 1. Render backend

In Render, create a Blueprint from your repository's reviewed branch using the
root `render.yaml`. It declares one Docker web service with `plan: free`, the
root `Dockerfile`, `/api/health`, and manual deploys to conserve build minutes.
It does not provision a database or persistent disk. Confirm the service still
shows Free before creating it. If Free is unavailable, stop rather than selecting
a paid plan. For an existing Blueprint, inspect its sync preview before applying
changes; this template switches backend updates to manual deployment.

The `CORS_ORIGINS` prompt takes your intended Pages origin, such as
`https://YOUR_PROJECT.pages.dev`. This is public configuration, not a secret.
If the final project name differs, edit this variable in Render and redeploy.
Use exact origins only, comma-separated if you have several. Never use
`*.pages.dev` or `*`. Do not set `VITE_API_BASE_URL` on the backend: its bundled
admin frontend must remain same-origin. Optional analytics stays disabled unless
you deliberately configure it separately.

After the initial build, copy your actual `https://YOUR_BACKEND.onrender.com`
origin. Open `/api/health` once and verify `{"ok":true,"ffmpeg":true}`. This is
a setup check, not a keep-awake monitor. If ffmpeg is false, verify that Render
built the Dockerfile rather than selecting its native Python runtime.

The Docker image includes a frontend for `/admin` and same-origin fallback use;
only this Render service runs the API, media proxy and Reddit video/audio mux.
Temporary mux files are deleted after streaming; there is no persistent media
storage. Restarts discard the cache and in-memory maintenance toggle. Use the
`MAINTENANCE_MODE` environment override for maintenance that must survive a
restart. Stay with one backend process because limits and maintenance are local
to that process.

## 2. Cloudflare Pages frontend

Use Pages Git integration on its Free plan. Set these build options:

- Root directory: repository root
- Framework preset: None (the commands below build the Vite multi-page app)
- Build command: `npm ci --prefix frontend && npm --prefix frontend run build:pages`
- Build output directory: `frontend/dist`
- Node version: 22, also recorded in `.node-version`
- Build environment variable: `VITE_API_BASE_URL=https://YOUR_BACKEND.onrender.com`
- Build environment variable: `SKIP_DEPENDENCY_INSTALL=1` (the build command
  performs the reproducible frontend install itself)

Set the variable for Production and any trusted Preview environment you use.
Hosted builds reject a missing, HTTP or malformed backend origin. The value is
public and compiled into the browser bundle; never place credentials in `VITE_*`.
Changing it requires a new frontend build.

The root `wrangler.jsonc` records the output directory. Change its `name` to your
actual Pages project name before deploying. For an existing Pages project,
review the file against that project's current settings before adopting it.
There are no Pages Functions or paid bindings in this setup.

Pages serves the generated HTML at `/`, `/tiktokvideodownloader`,
`/redditvideodownloader` and `/admin`. The included `404.html` prevents Pages from
treating every unknown URL as a single-page-app fallback. Do not add a catch-all
rewrite or an `/api` proxy. API and media traffic goes directly to Render.

Update Render's `CORS_ORIGINS` with the actual Pages origin after the name is
confirmed. For previews, allow only exact trusted preview origins or a stable
branch preview alias. Do not expose your backend to arbitrary preview code.

The Pages `/admin` entry redirects to the backend's `/admin`. Admin login and
controls run there with the existing Secure, SameSite=Strict cookie. No
cross-origin admin cookies or authentication bypass is introduced.

## 3. Verify before sharing

1. Open and refresh all four frontend routes. Confirm the admin redirect ends
   at your Render backend. Unknown paths should be 404 pages.
2. Resolve a public post you have permission to download. Browser requests to
   `/api/resolve`, `/api/proxy` and `/api/mux/...` must use Render, not Pages.
3. After an ordinary idle period, try again. The UI explains slow requests after
   10 seconds and aborts a stalled resolve after 90 seconds. A hosting HTML
   wake-up response becomes a retry message. There is no automatic polling.
4. Verify a small download first, including audio for Reddit. Test larger media
   sparingly because the test itself uses the free bandwidth allowance.
5. Check an invalid URL and an unlisted Origin. Confirm useful errors and no
   permissive CORS response. Check your provider usage and account billing setup.
6. Update canonical/Open Graph URLs and `frontend/public/sitemap.xml` to your
   domain before public indexing; upstream attribution is retained.

For local checks, use the commands in [the Vercel guide](vercel.md#3-verify),
substituting `npm run build:pages` for `npm run build:vercel` as needed. Normal
Docker builds still work without a frontend backend-origin variable.

Backend maintenance stops downloads but leaves the Pages static frontend up;
the next API action shows the maintenance error. If Render is suspended, waking
it repeatedly does not fix it. Check the reason in its dashboard and accept the
free-plan limit under a zero-dollar budget.

References: [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/),
[Pages routing](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[Wrangler Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/),
[Render Blueprint fields](https://render.com/docs/blueprint-spec).
