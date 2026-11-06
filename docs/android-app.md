# Daciana for Android

**Name:** Daciana · **Application ID:** `com.luwangtech.daciana` · **Version:** 0.1.0 (code 1)

The Capacitor 8 Android app bundles its customer interface inside the APK. It does not load a hosted website or install a PWA. The existing Next.js website and admin dashboard continue to run separately.

## Build and install

Use Node 22.18 or newer, JDK 21, and an Android SDK with Platform 36 and Build Tools 36. The build script detects the existing Homebrew JDK and macOS SDK. On another machine, set `DACIANA_JAVA_HOME` and `ANDROID_HOME` to their installed paths. Android Studio is optional for command-line builds.

```bash
npm ci
npm run android:debug
```

Install `artifacts/daciana-debug.apk` on an Android 7.0+ device. This APK is signed with a local **debug** certificate and is for testing. Android may ask you to allow installation from the app you use to open it.

For an attached device with USB debugging enabled:

```bash
adb install -r artifacts/daciana-debug.apk
```

Useful commands:

| Command                  | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `npm run mobile:dev`     | Preview the customer app at `http://127.0.0.1:5173`               |
| `npm run mobile:build`   | Type-check and build local web assets; scan for server secrets    |
| `npm run android:sync`   | Rebuild and copy the UI/plugins into Android                      |
| `npm run android:assets` | Regenerate icons and splash images from `assets/logo.png`         |
| `npm run android:open`   | Open the native project in Android Studio                         |
| `npm run android:debug`  | Build an installable test APK                                     |
| `npm run android:bundle` | Build the release Android App Bundle                              |
| `npm run test:mobile-ui` | Test the production mobile bundle against an isolated fixture API |

After changing the UI, use `android:debug` or `android:bundle` to rebuild it. A deployed Next.js change alone does not update an already installed APK. Catalog, shipping, orders, profiles and published More content continue to come from Supabase.

## Google sign-in and confirmation links

The app uses Supabase PKCE, launches Google in Android's system browser, and receives its return link through Capacitor. It never asks Google to sign in inside the app WebView. The Google Cloud web OAuth client keeps this authorized redirect URI:

```text
https://bcozsouelwdvlkcfxerx.supabase.co/auth/v1/callback
```

In [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/auth/url-configuration), add this exact **Redirect URL**, retaining your existing web callbacks:

```text
com.luwangtech.daciana://auth/callback
```

For a browser-only mobile preview that uses the real project, also allow `http://127.0.0.1:5173/auth/callback`. The production Android app always uses the custom scheme above. Keep Google provider credentials in Supabase, not in the native project. See [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) and the [Google setup guide](google-sign-in.md).

Sign-up email confirmation uses the same app link and the verifier saved on the originating device. Confirm from that device. A callback without a matching, unexpired flow cannot establish a session. Customers signing in from checkout return to checkout with their bag intact.

## Account deletion

Deploy the updated `supabase/functions/delete-account` directory to enable direct native requests:

```bash
supabase functions deploy delete-account --project-ref bcozsouelwdvlkcfxerx --use-api
```

Leave platform JWT verification enabled. The handler supports CORS, verifies the caller with Supabase Auth, and always deletes only that caller's ID. Email accounts re-enter their password and type `DELETE`. Google-only accounts type `DELETE` and confirm with the same Google account. The function verifies signed JWT claims and requires an OAuth authentication timestamp within five minutes; refreshing an old token is insufficient. It revokes sessions before deleting the account. No database password, service key, or Google secret is shipped in the APK.

## Native behaviour

- Android Back closes an open sheet, dismisses the keyboard, navigates back, then minimizes the app at Home.
- Safe-area handling protects the status/gesture bars. Bottom controls hide while the native keyboard is open.
- Session tokens and OAuth verifiers use Android Keystore-backed encrypted storage. No insecure native fallback is used. Android backup is disabled.
- Offline feedback appears immediately. The bag and favourites remain on the device; checkout and profile edits require a connection. Catalog and private screens are not a persistent offline database.
- More → Share app uses the Android share sheet. Set the public `VITE_PUBLIC_STORE_URL` before building if you want to share your hosted store during testing. Otherwise it uses the Play Store URL for this app ID, which works after publication.
- Admin stays in the Next.js web dashboard. Its server-only modules and credentials are rejected by the mobile bundler.

## Release signing

Create and retain an upload keystore for Google Play. Keep it outside this repository, with a separate backup. Supply its absolute path and credentials through your local shell or CI secret manager:

```text
DACIANA_ANDROID_KEYSTORE
DACIANA_ANDROID_KEY_ALIAS
DACIANA_ANDROID_STORE_PASSWORD
DACIANA_ANDROID_KEY_PASSWORD
```

Then run `npm run android:bundle`. With all four variables set, Gradle signs the release and produces `artifacts/daciana-release.aab`. Without them it produces `artifacts/daciana-release-unsigned.aab`, which needs signing before upload. Never use a debug keystore for publication. Increment `versionCode` in `android/app/build.gradle` for every Play update and keep `versionName` aligned with `package.json`.

Before publication, test the APK on real devices, including Google sign-in, confirmation links, account deletion, keyboard/back behaviour, and a controlled COD order. Complete your Play listing, privacy policy, data-safety declaration and account-deletion web page. The included browser tests simulate Google and database responses; they do not log into a real Google account or submit live orders.

## Code layout

`capacitor.config.ts` points at `mobile/dist`, with no production `server.url`. Vite builds the customer screens under `mobile/src`, using explicit adapters for navigation, native authentication and the shared Supabase readers/actions. Public configuration is injected explicitly; the build rejects server imports, admin code and server keys. `src/lib/customer-actions.ts` supplies the same input validation to the web and native app, while database RPCs/RLS remain authoritative for ownership, availability, prices, delivery and idempotency.
