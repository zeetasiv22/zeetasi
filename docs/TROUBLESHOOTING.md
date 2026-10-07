# Troubleshooting

## Docker unavailable

Verify `docker info`. In this sandbox a user-accessible Unix socket and a task-local dockerd data/exec directory were used. On your workstation start Docker Desktop or the system daemon. Do not expose unauthenticated TCP Docker access. The Supabase stack requires available local ports 54321–54324.

## Supabase missing configuration

Start the local stack with `npm run db:start`, then `node scripts/configure-local.mjs`. That script refuses to overwrite an existing `.env.local` unless `--replace` is explicit. For hosted projects use `.env.example` instead. Restart Next.js after changing public environment variables.

## Authentication redirects to login

Verify Supabase URL/key alignment, cookies, and the Auth user. Configure canonical Site URL and callback allowlist. Do not replace server `getUser()` checks with client-only redirects. Local Auth has confirmation disabled by default; production must configure SMTP and confirmation deliberately.

## No anime results

Inspect `/api/catalog?q=...&category=anime` and the displayed provider error. AniList can rate-limit or reject invalid genres. The client debounces requests and supports retry; the server uses timeouts and bounded retry. Check the provider's current terms and quota. Failed requests never substitute invented title data.

## TMDB or checkout unavailable

Set the server credentials documented in INTEGRATIONS.md. These flows intentionally fail closed while unconfigured. Do not insert fabricated success responses or activate paid subscriptions on a redirect.

## Playback fails

Check `/title/zeta-orbit` then the original video route. The packaged fixture is VP9 WebM. The sandbox FFmpeg lacks `libx264`; use `bash scripts/generate-video.sh`, which uses the available `libvpx-vp9` encoder. Confirm `ffprobe` and the browser's MediaError. A production source must have the correct content type, CORS/range behavior, browser codec support and distribution rights. This player does not implement DRM, HLS or DASH.

## XP does not increase after seeking

Expected: jumping to the end does not meet the elapsed-time and position-delta threshold. Play at normal speed through at least 90%. A completed episode awards only once. Starting another viewing session invalidates the old one. Playback above 1× may require another eligible watch to satisfy the time threshold; XP is not guaranteed for accelerated viewing.

## Avatar is locked

The server verifies XP and premium at equip time. Purchased cosmetics never grant staff permissions. Upload accepts JPEG/PNG/WebP up to 2 MB; unsupported or oversized images are rejected before storage.

## Development offline screen / stale chunks

Do not run `next build` and `next dev` concurrently against the same `.next` directory. Stop the dev process for a production build and restart it afterward. If a service worker is controlling a stale local page, unregister it in browser tools, reload, and verify `/api/health`. The worker never caches page HTML; an offline screen indicates a failed navigation request.

## Review not available

CodeRabbit CLI review was attempted, but the runtime reported that review is disabled for this task. Enable task review to obtain an independent review pass; no zero-findings claim was made.
