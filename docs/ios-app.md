# Daciana iOS app

**App:** Daciana · **Bundle ID:** `com.luwangtech.daciana` · **Team:** `VJ6CZ336M8` · **Version/build:** 1.0.4 / 1 · **Devices:** iPhone · **Minimum iOS:** 16.4

The iOS target is now implemented under `ios/App/App.xcodeproj`. It uses Capacitor 8.6.0, Swift Package Manager and the same bundled storefront as Android. Native source, brand artwork, the shared Xcode scheme and Swift package lockfile are committed; generated assets, build products, downloaded packages, profiles and credentials are ignored.

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

The native UI tests cover the initial WebView, Profile/sign-in controls, cart navigation, More and version information. They browse the public storefront without creating orders or signing into customer accounts. Use a guest simulator; do not run the guest-profile checks against a simulator containing a personal signed-in session. The default destination is iPhone 17 Pro. Set `DACIANA_IOS_SIMULATOR_ID` to a UUID from `xcrun simctl list devices available` to use another installed simulator. Results and screenshots are retained in `artifacts/ios/NativeSmoke-*.xcresult`.

Other commands:

- `npm run ios:sync`: build and verify production web assets, then sync iOS.
- `npm run ios:assets`: regenerate the native icon/splash from the existing `assets/logo.png`.
- `npm run ios:archive:unsigned`: compile a Release archive for the device SDK without provisioning. It cannot be installed or uploaded to App Store Connect.
- `npm run ios:archive`: create a signed archive using the distribution profile described below. It does not upload or publish anything.

## Distribution signing

The supplied team has a valid Apple Distribution identity on this Mac, but no registered development devices. Automatic archiving therefore requested an unavailable development provisioning profile. The build wrapper supports a manual **App Store Connect distribution profile** so a development iPhone is not a prerequisite for archiving.

1. In Apple Developer → Certificates, Identifiers & Profiles, verify/register `com.luwangtech.daciana` under team `VJ6CZ336M8`.
2. Create an App Store Connect distribution profile for that App ID and the existing Apple Distribution certificate.
3. Save the downloaded profile at `.secrets/ios/AppStore.mobileprovision`.
4. Run `npm run ios:archive`. The wrapper validates the profile's team, application identifier, expiration and distribution type before installing it in Xcode's local profile directory. It refuses to overwrite an existing archive.

Optional local overrides belong in ignored `.secrets/ios-release.env`, or the build environment:

```dotenv
DACIANA_IOS_TEAM_ID=VJ6CZ336M8
DACIANA_IOS_BUILD_NUMBER=1
DACIANA_IOS_PROFILE_PATH=/absolute/path/to/AppStore.mobileprovision
```

Increase the build number for later uploads. The marketing version comes from `package.json`; the build wrapper passes both numbers explicitly to Xcode. Signing certificates remain in Keychain. Do not share Apple account passwords or export signing keys into the repository.

A signed archive is only a build artifact. App Store validation, export, TestFlight upload and review are separate steps. After adding capabilities such as Apple sign-in or push, regenerate the distribution profile so it includes the final entitlements.

## Platform behavior already configured

- Existing Daciana icon and cream/brown launch artwork, with an opaque 1024 px icon.
- iPhone layouts, light appearance, dark status-bar text, keyboard/safe-area support.
- Custom URL scheme `com.luwangtech.daciana://auth/callback`, forwarded through Capacitor's scene delegate. This reuses the existing Google/password-recovery callback and does not change the hosted allowlist.
- Keychain-backed native session storage; browser storage is only for web test previews.
- Android Back/minimize handling runs only on Android.
- iOS Share app uses `VITE_IOS_STORE_URL` when configured, otherwise `https://dacianastore.in`. It never defaults to Google Play on iOS. Set the App Store link after the listing ID exists.
- App privacy manifest declares the current account/contact/address/purchase-history/user-ID data for app functionality, linked to the customer and not used for tracking. Capacitor and KeychainSwift also provide their SDK manifests. Final App Privacy answers still need an audit against the release SDKs and business practices.

## Remaining before App Store submission

- Native **Sign in with Apple** and Supabase Apple provider configuration. Existing email/password and Google code are reused; Apple's login option is not implemented in this foundation build.
- Apple-only account deletion with fresh authorization and server-side Apple-token revocation. Do not direct Apple-only users to a password they never created.
- iOS Firebase Messaging/APNs integration, Firebase iOS configuration and APNs credentials. Push settings currently remain Android-only; do not remove that guard before FCM token bridging is implemented. The stock Capacitor iOS push token is an APNs token, not an FCM token.
- Final privacy/SDK audit, App Store listing, screenshots, review account and delivery/test-order instructions.
- Real-iPhone TestFlight testing. Simulator checks do not establish actual Google/Apple authentication, APNs delivery or physical-device readiness.

See the [publishing plan](ios-app-store-plan.md) for the remaining work. The Android Play bundle at `artifacts/daciana-1.0.4.aab` is unchanged by the iOS setup.
