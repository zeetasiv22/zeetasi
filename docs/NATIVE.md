# Native application preparation

The delivered app is a responsive web application with a manifest and offline fallback. It has not been built, signed, submitted, or approved for Android/iOS stores.

Once the web product and provider rights are stable, evaluate:

- **Capacitor:** reuse responsive UI; retain API/server mutations on hosted Next.js. A static export cannot run the current server components/actions. Use a dedicated API contract and review store requirements for remote web content and payment links.
- **React Native:** implement native navigation/player and a typed API client. Reuse domain schemas and backend/RLS rules; React DOM components cannot be reused directly.

Before native implementation establish organization-owned app identifiers (for example `id.<operator>.zetahub`, not a claimed registered ID), Android SDK/JDK and Xcode/macOS CI, icon/splash assets, signing identities, keystore/keychain management and release channels.

Auth needs native PKCE redirects, Supabase allowlisted universal/app links, verified domains and tokens in OS secure storage rather than plain preferences. Notifications need APNs/FCM registrations, permission prompts, token rotation and server delivery retry. Playback needs actual-device codec/DRM and background/PiP testing. Request only required platform permissions.

Review store billing/subscription policies for the exact product and geography, content rights, account deletion, privacy labels, moderation/reporting and support contact details. No store policy compliance or release readiness is inferred from PWA installability.
