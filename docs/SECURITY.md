# Security model

- Supabase `getUser()` validates sessions on the server. Proxy refreshes cookies; private pages independently validate identity. Every mutation also checks identity.
- RLS is enabled for every public application table. User-owned watchlist, follows, comments, reports, notification preferences and progress are isolated by `auth.uid()`.
- The role matrix is separate from premium and cosmetics. Roles, XP, completions and subscriptions have no untrusted write policy. Definer functions use a fixed `search_path`. Users cannot self-promote, assign Owner, or remove an existing Owner through app endpoints.
- `staff_action` validates permissions, reason, target and protected-owner constraints. Role/entitlement changes and operational editor changes create audit entries in the same transaction. Client roles cannot update/delete audit rows.
- Authorized admins can still write directly to their RLS-permitted catalog/configuration tables. To make **every** direct database administrative edit audited, add database audit triggers or restrict those grants to RPC-only before production. Operator/service-role access is intentionally privileged and must be controlled operationally.
- A viewing session checks the episode and source, records server times and position deltas, caps credited intervals, and requires 90% eligible time plus 90% position. Concurrent retries lock the session; completion keys and XP event keys are unique. XP is capped at 500 completion XP/day. A browser can simulate heartbeats; this is abuse resistance, not proof of human attention or DRM.
- Midtrans notifications require the documented SHA-512 signature and an independent status request using the server key. Amount/order mismatch is rejected. Database locking and a unique transaction reference prevent duplicate entitlement. Refund/chargeback cannot be reversed by a delayed settlement. No raw card details are stored.
- Ad events record eligibility separately from reported image load. Client delivery reports are not trusted billing measurements. No revenue is computed from them.
- Avatar input is limited to 2 MB and decoded with a pixel limit, resized to 256×256 and re-encoded as WebP to remove metadata/embedded payloads. Storage is private; RLS-checked same-origin image reads follow profile visibility. Upload writes use the private server credential after authentication.
- User content is rendered as text through React. External provider descriptions have HTML stripped and are rendered as text; no `dangerouslySetInnerHTML` path exists.
- Next.js Server Actions provide origin/host validation. Custom mutation routes validate Origin. Cookies are managed by the supported Supabase SSR integration; production HTTPS is required.
- PostgreSQL limits comments, profile updates, follows, likes, reports, avatar changes and viewing-session creation. Supabase Auth enforces its configured limits. Add distributed perimeter limits for anonymous search, checkout, recovery, uploads and webhook traffic before public exposure.
- Baseline CSP, frame denial, MIME sniffing protection and referrer policy are set. CSP still allows inline/eval scripts for framework compatibility and arbitrary HTTPS media/image hosts; production should use nonces and approved provider host allowlists.
- Local service-role secrets are stored only in ignored `.env.local`. `.env.example` contains no credentials. Original unrelated repository files are not consumed by the application.

## Privacy and retention

Profiles are private by default. A user can export their own stored data from Settings → Account. The current export caps each table at 10,000 records; large exports need an asynchronous paginated export job. Account deletion is a tracked request workflow, not an automated retention-aware erasure system. Audit/financial retention rules and storage cleanup need operator-specific implementation before production. The PWA caches only an explicit list of public static assets and offline HTML; account pages, API data and video are not cached.

## Remaining hardening

MFA/device session UI, OAuth flows, password reauthentication for destructive changes, block-user filtering, automated abuse detection, production consent management, signed premium media URLs, notification delivery retries, operational audit triggers, dependency/security scanning in CI and a qualified penetration test remain outstanding. No production security certification is claimed.
