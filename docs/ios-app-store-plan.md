# Daciana iOS publishing plan

Prepared 16 November 2026. **Implementation started:** the native iOS target, branding, callback scheme, team configuration, platform fixes and native UI test target are in place. See the [iOS build guide](ios-app.md). Native Apple sign-in, Apple-specific deletion and the iOS FCM/APNs bridge are now implemented; the distribution profile is saved. The Firebase iOS app and local client configuration are prepared. Supabase Apple provider/secrets/deployment, Apple APNs key upload, signed validation and physical-device acceptance remain open. See [owner setup](ios-owner-setup.md).

## Agreed context and proposed scope

- Owner has an **Individual Apple Developer Program membership**.
- Owner has **no iPhone available**. Use simulators first and recruit an iPhone owner for TestFlight acceptance testing.
- Keep Capacitor and reuse the bundled React storefront, Supabase backend, existing catalog, INR pricing, saved addresses, COD checkout and order history.
- Proposed first release: **iPhone**, app name **Daciana**, bundle ID **com.luwangtech.daciana**, Shopping category, India distribution. These are recommendations; confirm the Apple identifier is available in the owner's team before registering it. iPad layouts can be a later phase.
- Proposed first iOS marketing version **1.0.4**, build **1**, matching the current storefront version. Apple build numbers are separate from Android's version code. The actual version follows the source shipped at build time.
- Implemented minimum OS: **iOS 16.4**, matching Tailwind 4's supported Safari baseline. Capacitor 8 itself documents iOS 15+ and Xcode 26+. Apple's current upload requirement is Xcode 26+ with the iOS 26 SDK. [Tailwind compatibility](https://tailwindcss.com/docs/compatibility), [Capacitor requirements](https://capacitorjs.com/docs/ios), [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/).

An Individual membership displays the account holder's legal name as the seller. The app name can still be Daciana. A company seller identity requires the appropriate organization enrollment; do not invent a legal entity. [Apple enrollment](https://developer.apple.com/programs/enroll/).

## Findings from this repository and Mac

| Area             | Current state                                       | Work needed                                                             |
| ---------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Native project   | Capacitor iOS target implemented                    | Signed archive, validation and physical-device acceptance               |
| Build assets     | `mobile/dist`, bundled locally                      | Reuse production build and secret scanning                              |
| Authentication   | Email/password, Google PKCE and native Apple bridge | Enable Supabase Apple; test all providers on iPhone                     |
| Account deletion | Apple proof verification and revocation implemented | Configure server key, deploy function and test disposable Apple account |
| Notifications    | Native iOS FCM bridge and Firebase app configured   | Upload APNs key; verify iPhone delivery                                 |
| Share app        | iOS uses website fallback                           | Set App Store URL once listing ID is available                          |
| Session storage  | Secure-storage plugin supports iOS Keychain         | Verify entitlement, session restoration, sign-out and deletion          |
| Toolchain        | Xcode 26.6 installed                                | Verify selected SDK, simulator availability and signing                 |
| Disk             | Cleanup completed; free space changes during builds | Monitor available space while resolving native SDKs                     |

Use roughly **20–30 GB of free disk space as a practical working budget**, not an Apple policy minimum. Do not delete upload keys, credentials or existing release bundles to make space.

## Phase 1 — iOS target and signing

1. Confirm the Apple Team ID, membership status and available bundle identifier. The owner signs into Xcode locally; passwords and two-factor codes stay out of chat and Git.
2. Add the matching Capacitor iOS package, initially pinning the version compatible with the installed Capacitor core. Generate `ios/`, choose the supported dependency manager after checking all plugins, and add build/sync/open/archive scripts.
3. Configure display name, iPhone deployment target, release signing and provisioning, URL scheme `com.luwangtech.daciana`, app icon and launch artwork from the existing brand assets.
4. Keep the UI bundled locally and server credentials excluded. Configure capabilities only for features actually used, including Sign in with Apple and push notifications.
5. Run the shell on small and large iPhone simulators. Check safe areas, bottom navigation, keyboard scrolling, forms, image galleries, sharing and offline recovery.

**Exit:** reproducible simulator build and a signed device archive, with no Android regressions.

## Phase 2 — Authentication and deletion

1. Keep email/password and Google sign-in. Add **Sign in with Apple** as the equivalent privacy-preserving login option for iOS; this is the recommended route for Daciana under Apple's social-login rule. [Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services).
2. Prefer a native Apple authorization flow with a nonce and Supabase identity-token verification. Select a maintained Capacitor 8 compatible bridge during implementation. Configure the Apple audience and capability in Supabase and Apple Developer. Preserve the existing Google and web provider settings. [Supabase Apple sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).
3. Capture the name when Apple first supplies it; handle later sign-ins without a name and Hide My Email addresses. Verify any email-relay configuration required for Daciana's Resend sender. Keep checkout phone/address entry available.
4. Test existing-account linking deliberately; never merge customers solely because they supply the same unverified email address.
5. Extend the deletion UI and Edge Function: Apple-only customers must not be asked for a password they never created. Verify fresh Apple authorization, revoke the Apple grant server-side, delete the account according to the documented retention policy, clear the local session and detach notification access. Test cancellation, wrong account, repeated attempts and failure recovery. [Apple deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion).
6. Verify Google callback handling, canceled sign-in, password recovery, checkout return and Keychain session behavior on iOS. Keep catalog browsing available without login.

**Exit:** all supported sign-in methods work, including Apple-only deletion, without orphaned private data or notification access.

## Phase 3 — iOS notifications

1. Register the iOS app in the existing Firebase project using the finalized bundle ID. Add `GoogleService-Info.plist` through the native configuration process.
2. Create/configure an Apple APNs authentication key and upload it to Firebase with its Key ID and Team ID. Keep the private `.p8` key outside source control and mobile assets. [Firebase iOS setup](https://firebase.google.com/docs/cloud-messaging/ios/get-started).
3. Bridge Firebase Messaging registration on iOS to the existing device-registration API. **Do not submit the stock Capacitor iOS registration value as an FCM token:** Capacitor returns an APNs token on iOS and an FCM token on Android. [Capacitor token contract](https://capacitorjs.com/docs/apis/push-notifications#token).
4. Remove Android-only guards once the iOS implementation is ready; keep Android channels confined to Android. Add appropriate APNs payload configuration to server delivery.
5. Preserve guest opt-in and separate promotional consent. Verify login linking, logout detachment, permission denial, token refresh, customer order updates, admin order alerts and notification destinations.

**Exit:** actual TestFlight iPhones receive notifications in foreground, background and terminated-app scenarios, and notification taps open the intended screen.

## Phase 4 — Privacy and submission material

- Audit each native dependency and required-reason API. Supply and validate `PrivacyInfo.xcprivacy`; do not guess declarations. [Capacitor privacy manifests](https://capacitorjs.com/docs/ios/privacy-manifest).
- Prepare App Privacy answers from actual account/contact/address/order/notification data flows and included third-party SDKs. Review encryption/export-compliance questions against the final binary. [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).
- Verify public privacy, support and account-deletion pages, support email `luwangtech0@gmail.com`, and the stated operator/retention practices.
- Prepare the icon, real screenshots, description, keywords, age-rating answers, copyright holder, review contact and a dedicated non-admin review account. Explain delivery-area selection and how reviewers can test checkout without creating a real fulfillment request. Agree on an isolated review/test-order process before submitting.
- Keep COD for physical cosmetics and stationery. Apple in-app purchase is not needed for these physical goods. [Guideline 3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods).
- Review the finished experience against Apple's minimum-functionality guidance: stable navigation, usable checkout, accounts, saved addresses and order tracking must work as an app. Native packaging alone does not establish review readiness. [Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality).

**Exit:** the App Store Connect record, disclosures, screenshots and reviewer instructions describe the actual release accurately.

## Phase 5 — TestFlight and release

1. Archive the signed release in Xcode, validate it and upload to App Store Connect. Retain the archive and symbols with the source revision and version metadata.
2. Recruit at least one trusted iPhone tester; preferably cover a small and a large screen and multiple supported iOS versions. A tester's iPhone is sufficient if the owner cannot obtain one.
3. Distribute through TestFlight. External testing may require beta review. Do not treat an IPA sent through WhatsApp as the normal installation route. [TestFlight workflow](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).
4. Record device results for sign-in, Apple deletion, COD/stock validation, notification permission/delivery/taps, address reuse, app relaunch, offline/reconnection, keyboard and accessibility. Confirm existing Android flows remain functional.
5. Resolve device failures, check the release archive and submission metadata, then submit for App Review. Use manual release after approval so publication timing stays under the owner's control.

**Exit:** real-iPhone acceptance tests pass and the reviewed version is approved for release. Apple review timing is external to the engineering work.

## Owner inputs and order of work

Immediate prerequisites: free disk space, confirm local Apple account access and Team ID, and find an iPhone tester. During setup: configure the App ID/capabilities and Firebase APNs credentials privately. Before submission: confirm distribution countries, copyright/operator identity, privacy details and reviewer access.

Implementation order: **storage/toolchain → iOS shell → Apple authentication and deletion → iOS push → TestFlight acceptance → App Review**. Do not submit an untested signed shell just because it archives successfully.

Initial engineering estimate: **about 5–8 working days** once account access, disk space and a tester are available. This is a planning estimate, not a commitment; provider setup, plugin compatibility, discovered bugs, tester availability and Apple review can extend it.
