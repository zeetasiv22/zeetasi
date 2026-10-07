# Deployment and operations

For Render, follow [the dedicated deployment guide](RENDER.md), including the Blueprint and hosted Supabase initialization.

## Prerequisites

Node 24, npm lockfile installation, a Supabase project, HTTPS application hosting and a canonical origin. Production provider integrations require the credentials and licenses listed in INTEGRATIONS.md. The local task stack is not a production deployment.

## Database

1. Create a separate staging Supabase project.
2. Link using the Supabase CLI and the project's approved login/DB credentials. Keep credentials outside source control.
3. Run `supabase db push` against staging and inspect the migration result. Never run local `db reset` against shared data.
4. `seed.sql` is **local development data**. For production, insert approved plan/cosmetic/settings configuration explicitly; do not load the original test catalog as commercial content.
5. Review `role_permissions`. Bootstrap the first owner only from a privileged operator SQL session after checking the exact Auth user UUID:

```sql
begin;
insert into public.user_roles(user_id, role) values ('<verified-auth-user-uuid>', 'owner');
insert into public.admin_audit_logs(actor,target,action,reason)
values ('<verified-auth-user-uuid>','<verified-auth-user-uuid>','bootstrap-owner','Initial owner verified by deployment operator');
commit;
```

There is no public owner-grant endpoint. Owner changes remain an out-of-band recovery operation. Keep at least one securely recoverable owner; use MFA on the hosting/Supabase operator accounts.

## Application

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Configure all required environment variables at build and runtime; `NEXT_PUBLIC_*` values are included in the browser build. On Vercel use the Next.js preset, Node 24 and `npm run build`. On a container/VM use a process supervisor and an HTTPS reverse proxy; preserve the canonical host and `X-Forwarded-*` headers correctly.

Set Supabase Auth Site URL and allowed redirects to the canonical URL and `/auth/callback`. Enable email confirmations and production SMTP. Provider OAuth and 2FA screens are not implemented in this delivery.

Configure Midtrans's sandbox notification callback and test its official payment flow before enabling live mode. Successful browser navigation does not activate entitlement. Payment state comes only from verified server reconciliation.

## Scheduler

Configure the hosting scheduler to make an authenticated GET to `/api/jobs` at least hourly. Send `Authorization: Bearer <CRON_SECRET>`. The endpoint expires active subscriptions and removes stale viewing sessions; entitlement reads already check `expires_at`, so access expires even if a scheduler run is delayed. Schedule notification delivery, series polling and leaderboard period jobs only after those workers are implemented; no such workers are claimed here.

## Readiness and logs

`GET /api/health` checks a real PostgreSQL query. It distinguishes configured providers from unconfigured providers; configuration is not equivalent to successful upstream health. Monitor HTTP error rates and Supabase database/Auth logs. A Sentry or other managed error-reporting integration is not yet wired.

## Backups and recovery

Enable managed PostgreSQL backups/PITR appropriate to the production plan. Back up storage objects separately; database backups alone do not contain image/video bytes. Test restoration into an isolated project and verify profiles, entitlements, payment-event uniqueness, audit history and media links before cutover. Retain the migration and lockfile revision with each release. Never log connection strings or service credentials in backup scripts.

For owner lockout use the Supabase operator account to verify identity and restore only the required role in a transaction with an audit row. No HTTP backdoor is provided.

## Release gates still required

Live TMDB, SMTP verification/recovery, payment sandbox callbacks, licensed media delivery, retention/legal policy review, independent security review, load tests and cross-browser playback tests. See DELIVERY.md for product scope that remains to be built.

### Playback update
Apply migration 11 after existing migrations, then optionally run `supabase/open-cinema.sql` for persisted open-film progress. The public `/open-cinema` page does not require a database to play the film. Add only licensed MP4/WebM sources in the playback admin editor; each quality variant needs its own row, the same episode ID, and a measured `height`. Use an owned media CDN at scale. Never use metadata posters or trailers as evidence of episode availability.

Local browser regression: with disposable local Supabase and registered Preview running, execute `node scripts/player-comments.browser.mjs`. It creates and deletes its own synthetic account, exercises actual video decoding and resolution changes, comment persistence and mobile overflow. Do not run it against production accounts.

### Episode subtitles
Apply migration12 before using `/admin/subtitles`. An administrator with catalog permission can save JSON containing `id`, `episode_id`, `language` (`id` for Indonesian), `label`, `url` (HTTPS WebVTT), `license`, and `enabled`, together with an audit reason. Serve subtitles with `text/vtt` and proper CORS; both video and text-track hosts must support anonymous CORS when tracks are enabled. A title is playable only when a usable source exists; metadata episode counts never create media files.

### Official embedded uploads
The six curated `/streaming/` pages need no new environment variables or migrations. Preserve the Content-Security-Policy frame/script origins and `Referrer-Policy: strict-origin-when-cross-origin`; YouTube error153 indicates missing client identity/referrer. Do not proxy YouTube video traffic or change browser geography to bypass provider restrictions. Error150 may reflect embedding/region/account/bot-verification restrictions; retain the provider's message. Keys/consumer login credentials are never collected by ZetaHub for these embeds. Source metadata validation runs server-side; actual playback must also be accepted by YouTube for the viewer.
