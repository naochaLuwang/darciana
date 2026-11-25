# Daciana iOS hosted setup

The native app is `com.luwangtech.daciana` under Apple team `VJ6CZ336M8`.
The supplied App Store Connect profile is saved privately and includes Apple sign-in and production push entitlements.
The App Store Connect app record has been created by the owner.

## 1. Enable native Apple login in Supabase

Open [Supabase Authentication → Providers](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/auth/providers), select Apple, enable it and add `com.luwangtech.daciana` under Client IDs. Preserve existing IDs and provider settings. This implementation uses native identity-token login: it does not require a Services ID, web callback or static six-month OAuth client secret. Keep nonce verification enabled.

The login button is available only in the iOS app. Email/password and Google remain available on all existing platforms. First-authorization Apple names are saved to account metadata; subsequent authorizations do not erase existing names. Hide My Email addresses are accepted. Register `dacianastore.in` and `noreply@dacianastore.in` under Apple's Sign in with Apple email communication configuration, and verify the existing Resend SPF/DKIM configuration, so order emails can reach private relay customers. See [Supabase native Apple setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple) and [Apple private email relay](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/).

## 2. Configure Apple account-deletion revocation

In Apple Developer → Certificates, Identifiers & Profiles → Keys, create a key with **Sign in with Apple**, configured for Daciana's primary App ID. Download the `.p8` once and save it locally at `.secrets/ios/apple-sign-in.p8`. Record its 10-character Key ID. An APNs key alone is not an Apple sign-in key.

Run locally, replacing the example with the actual public Key ID:

```sh
node scripts/prepare-ios-apple.mjs YOUR_KEY_ID
node scripts/prepare-account-deletion.mjs
```

In Supabase → Edge Functions → Secrets, add the two values from `.secrets/ios/apple-sign-in.env`:

- `APPLE_SIGN_IN_KEY_ID`
- `APPLE_SIGN_IN_PRIVATE_KEY_BASE64`

Keep these values in the Supabase server environment only. Do not put them in Vite, `NEXT_PUBLIC_`, the mobile app, GitHub or chat. The server generates a five-minute Apple client secret at request time.

Update the existing `delete-account` function. Replace **all** dashboard `index.ts` contents with the full generated `artifacts/account-deletion/index.ts`, preserving the deployed function's JWT-verification setting. This file is self-contained: no `handler.mjs` or local import needs to be added in the dashboard editor. Do not paste only the small repository `index.ts` file.

For a CLI account with project access, the equivalent deployment is:

```sh
supabase secrets set --project-ref bcozsouelwdvlkcfxerx --env-file .secrets/ios/apple-sign-in.env
supabase functions deploy delete-account --project-ref bcozsouelwdvlkcfxerx --use-api
```

The current Mac CLI account could list only another project when checked, so use the dashboard unless its project access changes. Local tests use generated cryptographic keys and fixtures; they never delete live accounts. Actual acceptance requires a disposable customer account: sign in with Apple, try cancelling deletion, try the wrong Apple identity, and then confirm deletion using the matching identity. Verify account/profile/address removal and revoked authorization under Apple Account → Sign in with Apple.

## 3. Configure Firebase iOS notifications

**Completed:** an Apple app with bundle ID `com.luwangtech.daciana` has been registered in the existing Firebase project **daciana-store**, and its verified `GoogleService-Info.plist` is saved at `ios/App/App/GoogleService-Info.plist`. Do not create a duplicate Firebase app. This client configuration is ignored by Git and copied into the native bundle by Xcode's Firebase configuration phase. On another Mac, retrieve the same app's configuration through Firebase or `node scripts/setup-ios-firebase.mjs` using private local server credentials. The Android `google-services.json` and Firebase Admin service-account JSON cannot replace this client configuration.

In Apple Developer → Keys, create an APNs authentication key (or reuse a suitable existing key). Configure access for Daciana and production delivery; if environment-specific keys are required, configure development/sandbox delivery separately for development testing. In Firebase → Project Settings → Cloud Messaging → Apple app configuration, upload the relevant APNs key(s) with their Key ID and Team ID `VJ6CZ336M8`. TestFlight uses production APNs. Never put APNs `.p8` keys in the app bundle.

Only Firebase Core/Messaging are linked; Analytics is not added. Auto initialization is disabled until a customer opts in. The AppDelegate maps APNs registration to an FCM token and forwards **only FCM tokens** to the existing backend. Disabling notifications deletes the FCM registration and removes its backend association. Guest opt-in, account linking, order updates and admin-recipient checks reuse the Android server flow. Android notification-channel calls are skipped on iOS.

Firebase 12.19.3 marks registration-token APIs as deprecated in favour of FID-only delivery. This release explicitly retains registration-token mode for compatibility with the existing Android/server pipeline and database token-length constraints. The new FID-only `register`/`unregister` APIs fail in registration-token mode. Plan a coordinated SDK/server/schema migration before upgrading to an SDK that removes the compatibility APIs; do not replace the token with a short FID in the current device-registration endpoint.

Deploy the updated website source to include the APNs alert/sound payload in `src/lib/push-delivery.ts`. Existing Supabase push tables support FCM tokens without a new schema migration. Verify actual guest, customer and admin deliveries on an iPhone through TestFlight; simulator/fixture checks do not prove APNs delivery.

## 4. Signed build and testing

```sh
npm run ios:archive
```

The archive wrapper verifies the Firebase project/bundle ID, production-push and Apple-sign-in profile entitlements, team and expiration. The local Google configuration must be present before a signed archive can be produced. The archive does not verify that cloud providers, keys or SMTP relay are correctly configured; complete those steps above before release.

Open the signed archive in Xcode Organizer, validate it, then distribute through App Store Connect. Upload does not publish the app. Complete TestFlight acceptance, accurate App Privacy declarations (including notification device identifiers), listing screenshots, review credentials and final review before public release. See [ios-app.md](ios-app.md).
