# Deploy ZetaHub to Vercel

The application uses Next.js App Router and Node 24. `vercel.json` declares the framework, locked install/build commands and a 30-second API function budget. No Docker, local filesystem database, media proxy, or background process is required on Vercel. Supabase runs separately.

1. Import `zeetasiv22/zeetasi` into your Vercel account and select the branch containing these changes.
2. Use Node **24.x** and the repository root. Build is `npm run build`, install is `npm ci`.
3. Prepare hosted Supabase and apply all migrations in order. Follow `docs/DEPLOYMENT.md` for authentication and database provisioning. Do not use sandbox `.env.local` credentials in production.
4. Add the environment variables documented in `.env.example` to the appropriate Vercel environments. Set `NEXT_PUBLIC_APP_URL` to the real HTTPS Vercel/custom domain. RapidAPI keys, service-role keys, payment keys and bootstrap credentials are **server-only**.
5. Add the deployed `/auth/callback` URL to Supabase's allowed redirects. Configure real email delivery and OAuth providers separately if used.
6. Provision the initial admin through the documented operator process against your hosted Supabase. Vercel does not execute the Render `npm start` admin-bootstrap step. Do not put bootstrap administration into a public route.
7. Read `docs/RAPIDAPI.md` before activating any provider. Apply the new shared cache/quota migration and set the server service-role credential before making production provider requests.
8. Deploy, check `/api/health`, `/api/providers/health`, authentication, search, and the actual provider playback acceptance flow. A successful deployment/build alone is not playback verification.

Signed media is delivered from the provider to the browser; ZetaHub does not bypass provider cookies, DRM, geo limits, CORS or access controls. If the selected provider needs headers/cookies that cannot be supplied legally and technically by a browser, do not label it supported.

## Installable app

The existing PWA includes a manifest, icons, an install button, standalone display, search/watch shortcuts and an offline notice. On a deployed HTTPS domain use **Instal aplikasi web**, or the browser's **Add to Home Screen** action. Only static public fallback assets are cached; accounts, API responses, keys, signed media and videos are not cached by the service worker.

PWA installation does not make streaming work offline and does not supply missing provider access. APK/store packaging is separate work after the required provider playback is verified and the target platform is selected. No Vercel or Render production deployment was performed as part of local verification.
