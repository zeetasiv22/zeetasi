# RapidAPI engine — verification status

Inspected 2026-10-07. **The real RapidAPI playback acceptance test is blocked.** No RapidAPI key or subscribed provider was available in this task. A request to the documented Anime Streaming search endpoint returned HTTP 401 (invalid/missing API key). Nothing in this document is evidence that Naruto, a drama episode, or a commercial film is playable in ZetaHub.

## Provider discovery

Public RapidAPI listing data, endpoint descriptions, pricing, and available example responses were inspected. Published plans can change; confirm the selected plan, hard limits, per-second limits, terms and playback permission before subscribing. No subscription was purchased or activated.

| Listing / owner | Host | Documented endpoints and playback evidence | Plan seen | Decision |
| --- | --- | --- | --- | --- |
| [Streaming Availability / Movie of the Night](https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability) | `streaming-availability.p.rapidapi.com` | GET `/shows/search/title?title=&country=&series_granularity=show`; GET `/shows/{id}?country=&series_granularity=episode`. Official SDK describes show/season/episode `streamingOptions[country][].link`, `videoLink`, `quality`, `expiresOn`. These are service deep links, not video files. | BASIC free: 1,000/month; PRO: $69, 25,000/month | Adapter implemented from official schema; METADATA, EPISODES, OFFICIAL_WATCH. Disabled until configured and tested. |
| [Anime Streaming / em8962](https://rapidapi.com/adarsh.chouhan11/api/anime-streaming/playground) | `anime-streaming.p.rapidapi.com` | GET `/search/{query}`, `/info/{id}`, `/watch/{episodeId}`. Watch describes `sources[].url`, `quality`, `isM3U8`, subtitles; optional `type`, `server`. **Example responses panel: “No example responses for this endpoint.”** | BASIC free: 10,000/month; PRO $10: 50,000/month; ULTRA $30: 200,000/month; MEGA $50: 500,000/month | Promising HLS candidate, not an active provider. Response envelopes, subtitle schema, source permission, CORS and actual playback remain unverified. No adapter guessed. |
| [MultiLang Movie & Drama Database / Cyber Developer](https://rapidapi.com/cyberdeveloper17/api/multilang-movie-drama-database-api/playground) | `multilang-movie-drama-database-api.p.rapidapi.com` | `/dramovnime/tab`, `/tabsearch`, `/filteritems`, POST `/list`, `/info`, `/detaildata`, `/getplay`. Getplay describes `vid_url` plus CloudFront `signCookie`. Listing claims DASH/HLS/MP4. | BASIC listed free, 500,000/month; paid plans $5/$8/$15. Some published quota fields are ambiguous. | Schema, title/episode mapping, authentication cookies, media rights and browser CORS require real investigation. No cookie/auth bypass and no speculative adapter. |
| [Gogoanime / Marouane](https://rapidapi.com/riimuru/api/gogoanime2/playground) | `gogoanime2.p.rapidapi.com` | `/search`, `/anime-details/{animeId}`, `/{server}/watch/{episodeId}` | BASIC free, PRO $3; published zero quota values do not prove unlimited access | Source repository linked in listing unavailable. Sample schema and playback permission unverified; disabled. |
| [Anime API / Abdullah Al Adnan](https://rapidapi.com/abdullahaladnan95/api/anime-api13/playground) | `anime-api13.p.rapidapi.com` | `/api/check`, `/api/info/{id}`, `/anime/api/details/{id}`, `/v1/api/details/{id}`. “Streaming links” claim only. | BASIC listed free: 500,000/month | No direct-media capability inferred from a listing name; disabled. |
| [AnimeSlayer / np4abdou1](https://rapidapi.com/np4abdou1/api/animeslayer-api/playground) | `animeslayer-api.p.rapidapi.com` | `/anime`, `/anime/{id}`, `/anime/{id}/episodes`, `/anime/{id}/episodes/{episodeId}/streams`. Example signed MP4 and documented encrypted resolver chain. | BASIC free: 5,000/month; PRO $4.99 | Excluded: resolver documentation does not establish authorized access/redistribution. No resolver or bypass implemented. |

Streaming Availability's [official SDK](https://github.com/movieofthenight/ts-streaming-availability/tree/84f216199238c5b183fa9bc26dcc5537a265f3ee/src) and [terms](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md) were read. Attribution is rendered alongside its search/detail/watch data. Its subtitle/audio *availability descriptions* are not downloadable subtitle/audio URLs and are not turned into fake tracks.

Other inspected listings had no provider-specific terms in their public terms field. RapidAPI marketplace access is not a content license. Unknown permission remains unknown.

### Category coverage

Searches included anime streaming, donghua, Chinese drama, Korean drama, Japanese drama, Thai drama, movie streaming and TV series streaming. Dedicated regional-drama/donghua playback was not verified. MultiLang is a candidate for these categories, not proof of coverage. Movie/TV discovery also surfaced availability and metadata listings; a “Streaming” name was not counted as playback evidence.

| Category | Current evidence |
| --- | --- |
| Anime | Anime Streaming documents HLS; real response/playback blocked |
| Donghua | No verified direct provider; MultiLang candidate requires testing |
| C-drama / Dracin | MultiLang candidate requires schema and real playback testing |
| K-drama | MultiLang description claims coverage; unverified |
| J-drama | No verified direct provider |
| Thai drama | No verified direct provider |
| Movies | Streaming Availability official links; MultiLang direct-source claim unverified |
| TV series | Streaming Availability documented seasons/episodes and official links; direct sources unverified |
| Animation / Documentary | Metadata/official-link genre filtering; no verified RapidAPI direct video |

Country of availability never establishes a title's country of origin. Unknown regional categories are not guessed. Provider alternatives are grouped only by matching stable external IDs and media type; similar titles alone never merge episodes or borrow playback.

## Configuration and activation

1. Apply all SQL migrations, including `202610070001_external_providers.sql` and `202610070002_provider_health.sql`, to your own Supabase project.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Set server-only `RAPIDAPI_KEY`. Never use a `NEXT_PUBLIC_` prefix. Requests use fixed documented RapidAPI hosts; redirects are refused and the key is never passed to the player.
4. Choose the actual viewer/operator region through `RAPIDAPI_COUNTRY` (default `id`). This does not circumvent regional restrictions.
5. Set `RAPIDAPI_MONTHLY_BUDGET` to **at most** your subscribed quota (default 1,000 per provider). Shared database reservations enforce monthly and minute limits across Vercel workers; production requests fail closed if the shared store is unavailable. API retries also consume quota. A worker cooldown additionally honors 429 Retry-After.
6. An operations-authorized admin opens `/admin/providers`. Test a real search, copy its native `providerId` into TEST TITLE / TEST EPISODES, then use a returned episode `providerId` for TEST PLAYBACK. TEST PLAYBACK validates a nonempty normalized source list, not just HTTP 200. An official-link pass does **not** prove embedded or direct video playback.
7. Verify the returned media in the player: decoded frames, progressing currentTime, supported browser codec, CORS, expiry, quality failover, actual subtitles, required access and terms. For iframe providers, use the documented player events; iframe load alone does not prove media playback.
8. Only after verification, add implemented adapter IDs to `RAPIDAPI_VERIFIED_PROVIDERS`. Currently only `availability` is implemented, and it is official-link-only. Adding a candidate name does not silently enable an unimplemented adapter.

Direct provider activation requires its authenticated response samples/documentation and permission evidence. This is outstanding work, not an environment switch that can manufacture missing adapters.

## Internal endpoints

- `GET /api/search?q=&category=&watchable=true` — parallel configured-provider search with independent failure handling; existing catalog metadata stays labeled as metadata. Watchable includes validated official links, labeled “Watch officially”.
- `GET /api/title/:id`
- `GET /api/title/:id/episodes`
- `GET /api/episode/:id`
- `GET /api/episode/:id/playback`
- `GET /api/providers/health` — latest observed status, not an expensive quota-consuming probe. Real requests and admin tests update health; observations older than five minutes degrade. Disabled adapters are `not_configured`.
- `POST /api/providers/test` — same-origin, signed-in user with operations permission required. Diagnostics bypass data cache and validate actual adapter responses.

Provider IDs are opaque `rp_...` references. Internal IDs never generate external video URLs. Streaming Availability episode references fingerprint the returned season/title and streaming-option metadata; changed identity is rejected before playback. Array positions are internal locators, never displayed as invented season/episode numbers. Existing legacy catalog IDs keep using their existing detail routes.

## Player and cache behavior

- Render only with `available=true` and at least one unexpired source. Official-only results render a link, no video/iframe.
- HLS uses native support when available, otherwise lazy-loaded hls.js. DASH uses lazy-loaded dash.js; MP4 uses native video. Selection preserves playback position.
- Two automatic retries per source, then the next returned source, then official fallback/unavailable. Stalled loads time out. Expired sources are never permanent video records.
- Authorized embed URLs must pass a provider capability and exact-host allowlist, and their host must be added to `frame-src` in CSP. No unverified embed provider is enabled. Cross-origin iframe errors cannot be fully inferred without documented provider events.
- Available subtitle files become tracks. No invented language choices.
- Search cache up to 5 minutes, title up to 10 minutes, episodes 5 minutes; responses carrying playback can expire sooner. Playback cache at most 30 seconds and at least 5 seconds before the earliest explicit expiry.
- Bounded worker cache coalesces concurrent identical requests; shared Supabase cache survives serverless worker changes. Shared quotas bound requests even across concurrent cache misses. No failed fetch is cached.
- `external_titles`, `external_episodes`, and `external_providers` retain metadata/diagnostics. `external_playback_sources` and `provider_cache` require `expires_at` and are backend-only under RLS. Expired rows are ignored and purged during quota reservations. No keys are stored there.

## Verification commands and acceptance boundary

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:providers:integration
node scripts/provider-player.browser.mjs
npm run build
```

Browser verification requires the registered shared Preview browser, Vite and FFmpeg with MP4/HLS/DASH muxers. It remuxes the repository’s original VP9 fixture into a temporary directory and checks actual decoded frames for MP4/HLS/DASH, source failure, subtitles, official fallback and no-empty-player states. It is **not** an end-to-end RapidAPI provider acceptance test. The shared Chromium reports no H.264 support, so successful browser tests use VP9 in MP4/fMP4; H.264 and Safari native HLS require a compatible browser.

Outstanding: a configured RapidAPI direct playback provider must pass **search → title → real episode → real source → video playback in ZetaHub**. No emulator in the installed CodeRabbit emulate v0.0.1 catalog implements RapidAPI or these media providers. Synthetic tests cannot substitute for that acceptance gate. Render production and Vercel production have not been changed by this implementation.
