# Updating the Play testing app

The website and native app share customer components, but they do not share a deployed JavaScript bundle. Android contains a compiled copy under `assets/public/`; it reads catalog data from Supabase. Publishing the website or changing database images does not install new gallery logic into an existing Android app.

## 1.0.3 / version code 4 — 10 November 2026

This update adds **Sign in → Forgot password?**, password recovery through the existing PKCE callback, and a new-password screen in the bundled app. Resets use Supabase Auth through Resend SMTP and must open on the requesting device. The recovery grant expires after 15 minutes; successful password changes clear it and sign out sessions before returning to sign-in.

Customer order receipts and status emails use a protected server endpoint and database hooks, independent of the optional push checkbox. The sender is **Daciana <noreply@dacianastore.in>**, with replies to `luwangtech0@gmail.com`. Recipients come from verified Auth accounts. Email history appears in Admin → Notifications. The owner confirmed SQL and custom SMTP setup; the Resend key and verified domain were checked through read-only API calls. See [email setup](resend-email.md) for server variables and deployment.

The signed upload is `artifacts/daciana-1.0.3.aab`, application ID `com.luwangtech.daciana`, version `1.0.3`, code `4`. It includes the earlier gallery and guest/admin push changes. Signing, upload-certificate matching, manifest and bundle validation pass. All 48 production mobile files match the AAB assets, and no Resend/server credentials are bundled. Unit/database tests (45) and mobile browser tests (10) pass. The web password-reset test passes; the broader 20-test web suite had one admin navigation timeout that passed on its focused rerun. Production Next.js compilation and local webhook authentication checks pass. No real email or push was sent.

Upload to the same Google Play testing track and update through Play. Confirm **More → Version 1.0.3**. Deploy this folder's updated Next.js source and the server environment values to activate the new website/email endpoints. Provider acceptance, actual inbox delivery and physical-device notification delivery are separate checks. Release evidence is under `artifacts/releases/1.0.3/`.

## 1.0.2 / version code 3 — 10 November 2026

This update includes the 1.0.1 product-gallery fixes and adds notification opt-in without signing in. Signing in links the registration to the verified account; signing out removes private order/admin access and retains guest announcement consent. Account deletion disables notifications on the device. Store announcements remain a separate opt-in.

New-order alerts use a database insert hook so both web and native checkout are covered. Only phones linked to currently enrolled admin accounts receive these alerts. Tapping one opens the order in the hosted admin dashboard after checking membership. See [notification setup](push-notifications.md) for the SQL, private webhook environment variable and website deployment required to activate the server side.

The signed upload is `artifacts/daciana-1.0.2.aab`, application ID `com.luwangtech.daciana`, version `1.0.2`, code `3`. Bundletool validation, signature/certificate matching, manifest checks, 16 KB bundle configuration and the mobile server-secret scan pass. All 49 mobile output files match the AAB assets. The Next.js production build, 39 unit/database tests and 9 native browser tests pass. Browser tests simulate FCM; actual notification delivery on a phone is still a required device check.

Upload this version to the same Google Play testing track as the installed app and update through Play. Check **More → Version 1.0.2**. The earlier 1.0.1 bundle does not contain these notification changes. Release evidence is in `artifacts/releases/1.0.2/`. The nullable guest upgrade was subsequently verified against the live database. The website was still serving the older authenticated-only registration endpoint at that check, so the updated source also needs deployment. Those checks are separate from binary validation.

## 1.0.1 / version code 2 — 10 November 2026

The previous 1.0.0 APK/AAB was built before the product-image fallback and product detail redesign. Inspecting its assets confirmed the new stock controls and styling were absent. The user confirmed they are testing through Google Play.

The reported product was `colors-queen-cushion-foundation`. The public database has a working product thumbnail, no product gallery rows, and four variants with no image references. The updated production mobile bundle was tested against that real catalog: every shade successfully displayed and loaded the product thumbnail. More displayed Version 1.0.1, and no renderer errors occurred. This browser check does not claim a physical-device installation test.

The signed update is `artifacts/daciana-1.0.1.aab`, package `com.luwangtech.daciana`, version name `1.0.1`, code `2`. Bundletool validation, signature verification, upload-certificate matching, target API 36 and 16 KB bundle alignment checks pass. All 45 files from the tested mobile output match the files packed into the AAB byte for byte. Evidence is under `artifacts/releases/1.0.1/`; the real-product preview is `artifacts/gallery-foundation/updated-app.png`.

Upload this AAB as a new release in the **same Google Play testing track** used by the installed app, then roll it out to that track. Once Play makes the update available, update through the Play Store and check **More → Version 1.0.1**. Revisit the foundation and switch shades. No catalog records were modified or artificial variant images added.

Do not sideload an upload-key-signed APK over a Play-installed app: Play App Signing uses a different distribution certificate. Use Play to update this installation. A version code cannot be reused once Play has accepted it; subsequent releases must increase it again.

Use `npm run android:bundle` after future bundled UI changes. It rebuilds production assets, scans for server secrets, syncs Android, and signs the bundle. `android:sync` alone does not produce or install an APK/AAB. The archive under `artifacts/releases/1.0.0/` preserves the prior signed bundle; earlier APK files remain old builds.
