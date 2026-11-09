# Daciana — first Google Play release

Prepared 9 November 2026. The signed binary is ready for internal testing. Production publication still depends on the live-service and owner checks below. Nothing has been uploaded to Play Console.

| Item                       | Release                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| App name                   | Daciana                                                             |
| Application ID / namespace | `com.luwangtech.daciana`                                            |
| Version name / code        | `1.0.0` / `1`                                                       |
| Target / minimum Android   | API 36 / API 24 (Android 7.0)                                       |
| Framework                  | Capacitor 8; customer UI bundled locally                            |
| Upload file                | `artifacts/daciana-release.aab`                                     |
| Phone test file            | `artifacts/daciana-release.apk`                                     |
| Support                    | `luwangtech0@gmail.com`                                             |
| Website                    | `https://dacianastore.in`                                           |
| Privacy policy             | `https://dacianastore.in/more/privacy-policy`                       |
| Public deletion request    | `https://dacianastore.in/delete-account` — deploy before submitting |

The application ID is consistent across Android, OAuth and Firebase. Its availability is only established when Google Play accepts the first upload; a local build cannot reserve it. Keep this ID for subsequent updates.

## Verified locally

- Signed release AAB and installable release APK built with JDK 21, Gradle 8.14.3 and Android Gradle Plugin 8.13.0.
- Google bundletool validates the AAB. Its signer matches the generated upload certificate.
- Release manifest has debugging, Android backups and cleartext traffic disabled.
- Target API 36 meets the current new-app target requirement.
- Bundled native libraries and bundle configuration checked for 16 KB alignment; real-device runtime testing remains necessary.
- Production mobile assets pass the server-secret scan. The Firebase Admin private key and Supabase server key are excluded.
- Web and Android Supabase Google OAuth redirect checks pass. This checks the allowlist, not an end-to-end Google sign-in on a phone.
- Production Next.js build, TypeScript and mobile build pass. ESLint has no errors; an existing product-editor unused-variable warning remains.

The merged permissions are Internet, network state, notifications, wake lock, FCM receive, and the app's non-exported receiver permission. No location, contacts, SMS, shared-photo-library, advertising-ID or query-all-packages permission is declared. Product photos are uploaded through the web admin, not a native broad media permission.

See `artifacts/play-store/technical-readiness.json` for fingerprints and the AAB checksum. Check results describe this binary, not Play review acceptance.

## Required before production review

- [ ] Add real active products, prices, stock, variant images and category images through the admin using Supabase Storage. The live project currently has **zero active products**. Replace disabled Cloudinary category/banner references when originals are available; no photos have been invented.
- [ ] Deploy the current Next.js website. The live `/delete-account` page and `/api/push/devices` endpoint currently return **404**. Configure server-only `SUPABASE_SECRET_KEY` and `FIREBASE_SERVICE_ACCOUNT_BASE64` on the hosting provider; see `docs/push-notifications.md`. Do not expose either variable to the client.
- [x] Deploy `supabase/functions/delete-account` and verify deletion from a disposable email/password customer account. Live verification passed on 9 November 2026: confirmation/password checks, account and address removal, and session refresh rejection. Physical-device Google reauthentication remains in the device checklist below.
- [ ] Review the supplied privacy-policy draft and update the public, admin-managed privacy page. The current text lacks the supplied support email and explicit push/FCM disclosure. Confirm the operator's legal name, actual delivery recipients, retention practices and any statutory recordkeeping with the owner. Daciana is used as the store name; no legal entity has been invented.
- [ ] Confirm both public policy/deletion URLs work without signing in, including on a phone. The new deletion page supports an email request without reinstalling the app. Actually monitor the support inbox and process verified requests.
- [ ] Create a dedicated, confirmed **non-admin reviewer account** and provide its email/password privately in Play Console → App access. Do not give reviewers owner credentials. Verify this account can reach profile, addresses, ordering and deletion without OTP or geographic access barriers.
- [ ] Install through Play internal testing and test Google sign-in/return to checkout, account creation and confirmation, profile/address save, selected shipping area, COD totals and order submission, offline/reconnect, keyboard, Back, safe areas, sign-out and account deletion.
- [ ] Test push permission denied/granted, opt-in, token registration, order updates, optional announcements, background delivery, notification taps and logout revocation on a physical device. No real notification has been sent as part of this release audit.
- [ ] Test on Android 13+ and Android 16, a smaller phone and a 16 KB page-size device/emulator. Review the Play pre-launch report, crashes and ANRs. Static alignment alone does not prove runtime behavior.
- [ ] Replace draft browser-preview screenshots with final phone screenshots of the populated app. Do not submit empty-catalog or fixture product screenshots as a finished shopping experience.

Changes to hosted APIs, legal content and the catalog generally do not require rebuilding this bundle. Changes to bundled UI, native permissions, app ID or SDKs do. After any binary change, rebuild and repeat release checks.

## Upload and signing

1. Complete the Personal developer account's identity/contact and any device-verification prompts in Play Console.
2. Create **Daciana**, choose Android app, the intended default language, and free distribution. Suggested category: **Shopping**. Choose supported countries based on the store's actual delivery service.
3. Enable **Play App Signing** and let Google generate/manage the distribution signing key. Upload `daciana-release.aab` under **Testing → Internal testing**. The private local key is the **upload key**, not Google's distribution key. Never upload the debug APK.
4. If Console requests an upload certificate, use `artifacts/play-store/upload-certificate.pem`. It is public. Do not upload the private `.p12` or its password file to the listing or GitHub.
5. Complete the store listing with the supplied text, support email, website, icon and feature graphic. Add at least two final app screenshots; four representative phone screens are preferable. Capture browsing, product variants/gallery, checkout and profile with non-sensitive test data.
6. Complete App content: privacy URL, account-deletion URL, App access, Data safety, Ads, IARC content rating, target audience, and any other Console declarations. Use the accompanying drafts as evidence, then confirm actual business practices. There is no ads SDK in this binary. Do not mark the app as collecting no data: it handles customer accounts, addresses, orders and notification identifiers.
7. Daciana sells physical goods using COD. No Play Billing integration is needed for those purchases. Do not introduce digital-goods payments under the same assumption.
8. Add testers, publish the internal-test release and distribute its Play opt-in link. A Play-installed build tests Google's signing path; the directly shared APK uses the local upload certificate.
9. **If the Personal developer account was created after 13 November 2023**, run the required closed test with at least **12 testers opted in continuously for 14 days**, then apply for production access. Internal testing does not replace this requirement. Record real feedback and fixes for the production-access application.
10. Resolve pre-launch findings, complete the checklist, then submit a production release. Store review and production-access approval are separate from building a valid AAB.

Google's app-signing certificate may be registered with services that explicitly need certificate fingerprints. The current Google sign-in uses Supabase's browser OAuth client, not a native Firebase Google sign-in client, so it does not depend on adding an Android SHA fingerprint to Firebase Auth.

## Protect the upload key

Private files, both ignored by Git:

```text
.secrets/android/daciana-upload.p12
.secrets/android-release.env
```

Back up both securely outside this machine using encrypted storage/password management. The second contains the path, alias and passwords; do not paste it into chat or put it in the submission ZIP. The alias is `daciana-upload`. Reuse this key for updates. `npm run android:upload-key` refuses to overwrite existing signing files.

To rebuild: `npm run android:bundle`. The wrapper loads the ignored local signing file or CI signing environment variables and refuses an unsigned release. `npm run android:release-apk` produces a phone-test APK. Increment `versionCode` in `android/app/build.gradle` for every future Play upload, including replacement test builds, and update `package.json`/lockfile for the visible version.

A release APK cannot update an installed debug APK with a different signing certificate. Use another test device, or intentionally uninstall the debug app first (which clears its local data). The Play-installed app also has Google's distribution certificate and should be updated through Play.

## Listing files

`artifacts/play-store/submission/` contains listing text, release notes, policy and Data safety drafts, reviewer instructions, a 512×512 icon and a 1024×500 opaque feature graphic made from the existing brand artwork. `draft-screenshots/` contains actual guest screens from the production mobile browser preview, labelled as drafts. It does not contain fabricated catalog data or private credentials.

## Official references, checked 9 November 2026

- [Target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465)
- [App signing](https://developer.android.com/studio/publish/app-signing)
- [16 KB page support](https://developer.android.com/guide/practices/page-sizes)
- [Listing graphics and screenshots](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [Privacy and user data](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Physical goods and payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Firebase SDK Data safety disclosure](https://firebase.google.com/docs/android/play-data-disclosure)
