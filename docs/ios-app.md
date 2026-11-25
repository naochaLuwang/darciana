# Daciana iOS app

**App:** Daciana · **Bundle ID:** `com.luwangtech.daciana` · **Team:** `VJ6CZ336M8` · **Version/build:** 1.0.4 / 2 · **Devices:** iPhone · **Minimum iOS:** 16.4

The iOS target is now implemented under `ios/App/App.xcodeproj`. It uses Capacitor 8.6.0, Swift Package Manager and the same bundled storefront as Android. Native source, brand artwork, the shared Xcode scheme and Swift package lockfile are committed; generated assets, build products, downloaded packages, profiles and credentials are ignored.

**Release correction, 19 November 2026:** The original 1.0.4 (1) archive starts a default Capacitor controller from `SceneDelegate`, bypassing the custom Apple sign-in and messaging plugins. Scene startup now creates `DacianaViewController` directly. Signed build 2 includes this fix and has been exported locally; follow the [build 2 upload steps](ios-upload-build-2.md) to replace the owner's submitted build 1. Successful Apple login still needs verification on signed TestFlight software.

The deployment target is iOS 16.4 because the app uses Tailwind 4, whose supported Safari baseline is 16.4. Capacitor's lower platform minimum does not establish compatibility for the storefront. [Tailwind compatibility](https://tailwindcss.com/docs/compatibility).

## Build and run

Use macOS with full Xcode 26 or newer selected. The production mobile build reads the existing public Supabase configuration from `.env.local`; private server keys must never be added to client variables.

```sh
npm run ios:simulator
npm run ios:open
```

Select the **App** scheme and an iPhone simulator in Xcode, then Run. The command-line build also copies the simulator bundle to `artifacts/ios/Daciana-simulator.app`. This `.app` is for the simulator; it is not an installable iPhone distribution file.

```sh
npm run ios:test
```

The native UI tests cover the initial WebView, Profile/sign-in controls, cart navigation, More and version information. The Apple authorization test also presses the Apple button to exercise the real native bridge; an unsigned simulator can return an Apple authorization error or ask for an Apple Account, but must not report an unimplemented Capacitor plugin. Tests do not submit orders or complete sign-in to customer accounts. Use a guest simulator; do not run the guest-profile checks against a simulator containing a personal signed-in session. The default destination is iPhone 17 Pro. Set `DACIANA_IOS_SIMULATOR_ID` to a UUID from `xcrun simctl list devices available` to use another installed simulator. Results and screenshots are retained in `artifacts/ios/NativeSmoke-*.xcresult`.

Other commands:

- `npm run ios:sync`: build and verify production web assets, then sync iOS.
- `npm run ios:assets`: regenerate the native icon/splash from the existing `assets/logo.png`.
- `npm run ios:archive:unsigned`: compile a Release archive for the device SDK without provisioning. It cannot be installed or uploaded to App Store Connect.
- `npm run ios:archive`: create a signed archive using the distribution profile described below. It does not upload or publish anything.

## Distribution signing

The supplied team has a valid Apple Distribution identity on this Mac. The downloaded App Store Connect profile is saved in `.secrets/ios/AppStore.mobileprovision` and includes Apple sign-in and production push capabilities. The owner has created the App Store Connect app record. There are no registered development devices. Automatic archiving therefore requested an unavailable development provisioning profile. The build wrapper supports a manual **App Store Connect distribution profile** so a development iPhone is not a prerequisite for archiving.

1. In Apple Developer → Certificates, Identifiers & Profiles, verify/register `com.luwangtech.daciana` under team `VJ6CZ336M8`.
2. Create an App Store Connect distribution profile for that App ID and the existing Apple Distribution certificate.
3. Save the downloaded profile at `.secrets/ios/AppStore.mobileprovision`.
4. Run `npm run ios:archive`. The wrapper validates Firebase iOS configuration and the profile's team, application identifier, Apple sign-in/push entitlements, expiration and distribution type before installing it in Xcode's local profile directory. It refuses to overwrite an existing archive.

Optional local overrides belong in ignored `.secrets/ios-release.env`, or the build environment:

```dotenv
DACIANA_IOS_TEAM_ID=VJ6CZ336M8
DACIANA_IOS_BUILD_NUMBER=2
DACIANA_IOS_PROFILE_PATH=/absolute/path/to/AppStore.mobileprovision
```

Increase the build number for later uploads. The marketing version comes from `package.json`; the build wrapper passes both numbers explicitly to Xcode. Signing certificates remain in Keychain. Do not share Apple account passwords or export signing keys into the repository.

A signed archive is only a build artifact. App Store validation, export, TestFlight upload and review are separate steps. After adding capabilities such as Apple sign-in or push, regenerate the distribution profile so it includes the final entitlements.

The current signed archive and local App Store export are `artifacts/ios/Daciana-1.0.4-2.xcarchive` and `artifacts/ios/Daciana-1.0.4-2.ipa`. Signature, bundle identity, capabilities, Firebase configuration and bundled production assets have been checked. Build 2 has **not** been uploaded by the agent or accepted by App Store Connect; physical-device acceptance remains pending. The owner reported that build 1 was waiting for review or in review on 19 November 2026. For manual signing, use the archive wrapper: it passes the profile through an app-target-only build setting so Firebase resource bundles do not inherit an invalid provisioning profile.

## Platform behavior already configured

- Existing Daciana icon and cream/brown launch artwork, with an opaque 1024 px icon.
- iPhone layouts, light appearance, dark status-bar text, keyboard/safe-area support.
- Custom URL scheme `com.luwangtech.daciana://auth/callback`, forwarded through Capacitor's scene delegate. This reuses the existing Google/password-recovery callback and does not change the hosted allowlist.
- Keychain-backed native session storage; browser storage is only for web test previews.
- Android Back/minimize handling runs only on Android.
- iOS Share app uses `VITE_IOS_STORE_URL` when configured, otherwise `https://dacianastore.in`. It never defaults to Google Play on iOS. Set the App Store link after the listing ID exists.
- App privacy manifest declares the current account/contact/address/purchase-history/user-ID/notification-device-ID data for app functionality, linked to the customer and not used for tracking. Capacitor and KeychainSwift also provide their SDK manifests. Final App Privacy answers still need an audit against the release SDKs and business practices.

## Authentication and notifications

- Native Apple authorization uses AuthenticationServices, a fresh random state and SHA-256 nonce. Supabase verifies the identity token with the original nonce. The Apple button appears on iOS account and checkout sign-in screens; Google and email sign-in remain available.
- Apple first-authorization names are saved without overwriting existing names. Subsequent authorizations may omit the name.
- Apple-linked deletion requires confirmation and new Apple authorization, verifies its signature/issuer/audience/subject/nonce/age against the authenticated caller's identity, exchanges its single-use code, revokes the Apple refresh token, then revokes Supabase sessions and deletes the account. Missing secrets or failed revocation leave the account intact. Private Apple keys stay in Supabase Edge Function secrets.
- Firebase Messaging 12.19.3 is pinned separately from Capacitor's generated Swift package. The native bridge maps APNs registration to FCM tokens; raw APNs tokens are never registered with the FCM backend. Android channel APIs are called only on Android.
- Messaging auto initialization is disabled until opt-in. Guest registration, account association, sign-out/deletion cleanup, notification taps and admin authorization reuse the existing protected device-registration API. Native configuration is copied from the ignored `ios/App/App/GoogleService-Info.plist` file. Only Messaging/Core, not Analytics, are linked.

## Remaining before App Store submission

- Enable Supabase Apple login with the native bundle ID.
- Configure the Sign in with Apple key as server-only Edge Function secrets and deploy the updated deletion function. Register the Resend sender/domain for Apple's email relay. See [owner setup](ios-owner-setup.md) for exact dashboard steps and the self-contained deployment file.
- Upload the APNs authentication key to the existing Firebase project's iOS app and deploy the updated website notification payload. The iOS Firebase app and matching local client configuration have been prepared.
- Final privacy/SDK audit, App Store listing, screenshots, review account and delivery/test-order instructions.
- Real-iPhone TestFlight acceptance. Simulator and fixture checks do not establish actual Google/Apple authentication, revocation, email-relay delivery or APNs delivery.

See the [publishing plan](ios-app-store-plan.md) for the remaining work. The Android Play bundle at `artifacts/daciana-1.0.4.aab` is unchanged by the iOS setup.
