# ZetaHub

**Semua Hiburan, Satu Tempat.** A working Next.js + Supabase streaming/catalog foundation with Indonesian UI, live AniList metadata, authorized local video, persistent accounts and collections, and database-enforced permissions.

This repository previously contained unrelated files (`InVisbleSecurity`, `Key`, `Security`, `config.json`); those are preserved and not used by the web application.

## Deploy ke Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zeetasiv22/zeetasi/tree/coderabbit/push-changes-to-github/1945a175)

Siapkan Supabase cloud terlebih dahulu, terapkan migrasi dan `supabase/bootstrap.sql`, lalu isi environment variable di Render. Ikuti [panduan Render langkah demi langkah](docs/RENDER.md). Jangan gunakan kredensial Supabase lokal dari Preview untuk deploy cloud.

## Run locally

Requires Node 24, npm, and a working Docker daemon. Dependencies are locked in `package-lock.json`.

```bash
npm ci
npm run db:start
node scripts/configure-local.mjs
npm run dev
```

Open **http://localhost:3000**. Supabase API is `http://127.0.0.1:54321`; local email inbox is `http://127.0.0.1:54324`. The local auth configuration does not require email confirmation; enable and test confirmation before public deployment.

`db:start` starts the repository's local Supabase stack, applies migrations and clearly labeled seed configuration. The original CC0 video is included at `public/media/zeta-orbit.webm`; `scripts/generate-video.sh` reproduces it with FFmpeg VP9 support. It is a test film, not licensed commercial entertainment.

To reset **disposable local data only**:

```bash
npm run db:reset
```

Do not reset a shared/production database. Configure hosted Supabase with `.env.example` instead of the local configuration script.

## Working flows

- Responsive cinematic homepage, mobile navigation, carousels, live AniList search/detail, genre discovery, honest unavailable states for TMDB without credentials.
- Supabase registration/login/logout and PKCE recovery boundary; protected account/staff routes; persisted profiles and privacy.
- Watchlist, series follows, comments, spoilers, likes, author deletion, moderation, reports, notification inbox/preferences.
- Original authorized playback; resume positions; server-validated time/position thresholds; unique completion, XP, achievement and notification events; free-account ad eligibility every two episodes.
- Premium plans from PostgreSQL; Midtrans checkout/webhook boundary; server-only payment settlement; audited manual grants/revocation.
- Avatar frames enforced by entitlement/XP, image uploads through server re-encoding, personal data export.
- Role/permission matrix, owner protection, account suspension, XP adjustments and audit logs; operational tables and validated JSON record editors for selected admin modules.
- Manifest, icons, public-assets-only service worker and offline fallback.

**This is not the entire requested Ultimate feature set.** Read the precise [delivery matrix and remaining work](docs/DELIVERY.md). No live payment, commercial content license, production SMTP delivery, mobile store release, or production readiness is claimed.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Integration tests require local Supabase and `.env.local`; they deliberately refuse non-loopback deployments. They create and clean synthetic accounts, use a privileged **test-only** clock fixture for completion checks, and verify RLS and financial/XP idempotency. The production RPC has no fixture bypass.

## Architecture

- `src/app/[[...path]]/page.tsx`: server-rendered route dispatch with private-route authentication.
- `src/components/`: reusable catalog, account, admin, community and player interfaces.
- `src/app/actions.ts`: server mutations and validation.
- `src/app/api/`: typed catalog boundary, authenticated playback/avatar/export, payments, health and scheduler endpoints.
- `src/lib/`: server-only clients, normalized catalog/domain logic, schemas and signature validation.
- `supabase/migrations/`: RLS, roles, application tables and transactional RPCs.
- `supabase/seed.sql`: initial plans/cosmetics and explicitly identified original playback fixture.

Provider secrets are server-only. Cosmetic titles, XP, and premium never assign administrative roles. Database policies enforce authority even if a caller bypasses the UI.

## Documentation

- [Deployment & recovery](docs/DEPLOYMENT.md)
- [Integration configuration and verification](docs/INTEGRATIONS.md)
- [Security model and remaining hardening](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Native app preparation](docs/NATIVE.md)
- [Delivered and outstanding capabilities](docs/DELIVERY.md)

## RapidAPI and Vercel

See [provider research, activation requirements and playback verification](docs/RAPIDAPI.md) and [Vercel deployment / installable PWA](docs/VERCEL.md). The provider engine and adaptive player are implemented; **a real RapidAPI direct-playback provider remains unverified and inactive** pending credentials, response samples and successful end-to-end playback. Streaming Availability supplies official watch links only.
