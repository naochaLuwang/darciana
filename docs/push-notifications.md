# Android push notifications

Daciana uses `@capacitor/push-notifications` 8 and Firebase Cloud Messaging. Supabase remains the account and store database. This integration is Android-only; browser push is not enabled.

## Configuration

1. Register Android package `com.luwangtech.daciana` in the Firebase project.
2. Put its `google-services.json` in `android/app/google-services.json` before building. This file is ignored by Git and must also be provided to any Android CI build.
3. Run `supabase/push-setup.sql` in the Supabase SQL Editor. The two tables have RLS enabled and grant access only to `service_role`. Customer clients cannot list device tokens or sending history.
4. Configure these **server-only** environment variables in the website's hosting dashboard:

   - `SUPABASE_SECRET_KEY`: the existing Supabase server key.
   - `FIREBASE_SERVICE_ACCOUNT_BASE64`: the entire service-account JSON encoded as base64. Base64 is not encryption; treat it as a private key.

   Local setup has saved the Firebase value in `.env.local` and `.secrets/firebase-server.env`. Copy the value after `FIREBASE_SERVICE_ACCOUNT_BASE64=` into the host's environment setting. These files are ignored and restricted to the local user. Never prefix this variable with `NEXT_PUBLIC_` or `VITE_`.

5. Deploy the updated Next.js application with these variables. The Android app registers at `https://dacianastore.in/api/push/devices`; the endpoint must be deployed before registration can work. `VITE_API_URL` can override this host at Android build time. It must be an HTTPS origin for physical-device builds.
6. Build/install the updated APK using `npm run android:debug`.

The Firebase private key is not included in the Android assets. `scripts/check-mobile-build.mjs` checks the generated bundle for server credentials.

## Customer controls

Open **More → App → Notifications**, sign in, and enable push notifications. Android 13+ asks for notification permission. Store announcements have a separate opt-in, initially off. When permission has been denied, enable it in Android Settings → Apps → Daciana → Notifications.

The app registers tokens after permission is granted, refreshes the registration on app resume/reconnection, and saves the installation capability in Android encrypted storage. Sign-out disables FCM, clears delivered notifications, and revokes the server registration. If revocation cannot reach the server, it remains pending and retries on the next connection. Switching accounts requires enabling notifications for the new account. Deleting an account cascades deletion of its registered devices.

## Sending

- **Admin → Notifications** sends announcements to devices with the announcements preference enabled. Enter a title, message and destination, review the preview, check the confirmation and send. Counts describe devices, not unique customers.
- The order status form has an optional **Send the customer a push notification** checkbox. Supported statuses are confirmed, completed and cancelled. The order status is saved even if FCM is unavailable; the result explains any sending problem. Sends target only that order's account.
- Titles are limited to 80 characters and messages to 240. Notification taps accept only `/`, `/shop`, `/categories`, `/account`, `/more`, `/product/<slug>` or `/more/<slug>`. Order updates open the customer's account/orders screen.
- The separate Android channels are **Order updates** and **Store announcements**. The white D notification icon is separate from the launcher icon.
- Sending history prevents a repeated request from resending the same announcement or order status. FCM success means accepted by FCM, not proof of display/read. Expired tokens are removed; unknown sending outcomes are not automatically retried to avoid duplicates.

## Test on a phone

Install the APK, sign in, open More and enable notifications. Enable store announcements if testing a broadcast. The admin device count should increase after registration. Send a short test from the admin page, place the app in the background and check that it appears. Tap it and verify the chosen page opens. Also test while the app is open, after closing it normally, after denying permission, and after sign-out. Android force-stop can prevent delivery until the app is opened again.

The local Firebase verification used an FCM validation-only request: it verified credentials/API access without delivering messages. Physical-device delivery still requires the updated backend deployment and an installed, registered APK.
