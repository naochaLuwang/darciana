# Android push notifications

Daciana uses `@capacitor/push-notifications` 8 and Firebase Cloud Messaging. Supabase remains the account and store database. This integration is Android-only; browser push is not enabled.

## Configuration

1. Register Android package `com.luwangtech.daciana` in the Firebase project.
2. Put its `google-services.json` in `android/app/google-services.json` before building. This file is ignored by Git and must also be provided to any Android CI build.
3. Run the updated `supabase/push-setup.sql` in the Supabase SQL Editor, including the additive `user_id DROP NOT NULL` statement for guest registrations. The two tables have RLS enabled and grant access only to `service_role`. Customer clients cannot list device tokens or sending history. For admin new-order alerts, follow the additional setup below.
4. Configure these **server-only** environment variables in the website's hosting dashboard:

   - `SUPABASE_SECRET_KEY`: the existing Supabase server key.
   - `FIREBASE_SERVICE_ACCOUNT_BASE64`: the entire service-account JSON encoded as base64. Base64 is not encryption; treat it as a private key.

   Local setup has saved the Firebase value in `.env.local` and `.secrets/firebase-server.env`. Copy the value after `FIREBASE_SERVICE_ACCOUNT_BASE64=` into the host's environment setting. These files are ignored and restricted to the local user. Never prefix this variable with `NEXT_PUBLIC_` or `VITE_`.

5. Deploy the updated Next.js application with these variables. The Android app registers at `https://dacianastore.in/api/push/devices`; the endpoint must be deployed before registration can work. `VITE_API_URL` can override this host at Android build time. It must be an HTTPS origin for physical-device builds.
6. Build the updated app. For an existing Play testing installation, use `npm run android:bundle` and distribute the new AAB through the same testing track. A website deployment does not update bundled mobile code.

The Firebase private key is not included in the Android assets. `scripts/check-mobile-build.mjs` checks the generated bundle for server credentials.

## Customer controls

Open **More → App → Notifications** and enable push notifications; sign-in is optional. Android 13+ asks for notification permission. Store announcements have a separate opt-in, initially off. Guests need this second switch enabled to receive store broadcasts. Customer order updates become available when the device is linked to a signed-in account. When permission has been denied, enable it in Android Settings → Apps → Daciana → Notifications.

The app registers tokens after permission is granted, refreshes registration on app resume/reconnection, and saves the installation capability in Android encrypted storage. A guest registration has `user_id = null`; linking an account requires a verified Supabase access token, never a supplied user ID. Changing or deleting a registration requires proof of the installation secret, whose hash is stored on the server.

Sign-in links the existing opt-in to that account. Sign-out invalidates the account's FCM token, clears delivered notifications and revokes its private association, then retains the device's guest announcement preference. Revocation retries after reconnection if needed. Switching accounts removes the old private association before linking the new one. Account deletion disables this device's notifications entirely; account-linked registrations also cascade on Auth deletion. Users can stop guest notifications with the switch or Android settings.

## Admin new-order alerts

The database schedules an HTTPS request after each new `storefront_order_requests` insert, covering orders from both web checkout and the bundled app. Only devices currently linked to a member of `private.storefront_admins` receive the alert. Announcements are not required for these operational alerts. Guest or ordinary customer registrations cannot opt into the admin audience.

1. Run `node scripts/prepare-order-push.mjs`. This retains an existing secret or generates a new one, without printing it. It writes ignored, restricted files `.secrets/notifications-setup.sql` and `.secrets/order-push-webhook.env` and saves the local server variable.
2. Run the entire private SQL file in the Supabase SQL Editor. It combines the updated push tables, service-only admin recipient lookup, `pg_net`/Vault setup, and the insert trigger. It stores the webhook secret in Vault as `daciana_order_push_secret`. No old orders are broadcast and no customer data is deleted. The public source scripts are `supabase/push-setup.sql`, `supabase/admin-order-push-setup.sql` and `supabase/order-push-webhook-setup.sql`.
3. Copy `ORDER_PUSH_WEBHOOK_SECRET` from the private environment file into the website host's **server-only** environment. Do not prefix it with `NEXT_PUBLIC_` or `VITE_`, commit it, or paste it into chat. Keep it identical to the Vault value. Retain the existing Supabase and Firebase server variables.
4. Deploy the Next.js project, including `/api/push/new-order`. The callback uses a constant-time secret check, loads the real order by UUID, selects enrolled admins on the server and claims a unique order event before contacting FCM. An unsigned request receives 401 once configured; 503 indicates missing configuration, and 404 can indicate undeployed code.
5. Update through Play, sign into the app with the enrolled admin account and enable **Push notifications** in More. Repeat for each admin device. Signing into the browser dashboard alone does not register a phone. Tapping the alert opens that order in the hosted dashboard after a membership check; normal dashboard authentication still applies.

The payload contains an order reference and whole-rupee total, not the customer's name, phone or address. **Admin → Notifications** history labels these events **New order alert**. The database hook never rolls back an order if scheduling fails. Delivery is best effort: inspect `net._http_response` for transport failures and the notification history for FCM results. Unknown outcomes are not automatically retried. For a controlled resend, investigate the event first; do not remove deduplication records blindly.

## Sending

- **Admin → Notifications** sends announcements to devices with the announcements preference enabled. Enter a title, message and destination, review the preview, check the confirmation and send. Counts describe devices, not unique customers.
- The order status form has an optional **Send the customer a push notification** checkbox. Supported statuses are confirmed, completed and cancelled. The order status is saved even if FCM is unavailable; the result explains any sending problem. Sends target only that order's account.
- Titles are limited to 80 characters and messages to 240. Notification taps accept only `/`, `/shop`, `/categories`, `/account`, `/more`, `/product/<slug>` or `/more/<slug>`. Order updates open the customer's account/orders screen.
- The separate Android channels are **Order updates**, **New orders** (admin), and **Store announcements**. The white D notification icon is separate from the launcher icon.
- Sending history prevents a repeated request from resending the same announcement or order status. FCM success means accepted by FCM, not proof of display/read. Expired tokens are removed; unknown sending outcomes are not automatically retried to avoid duplicates.

## Test on a phone

Install the current app through the Play testing track. First test More as a guest: grant permission and separately enable announcements. Verify the device count increases, then send a deliberate test from the admin page with the app backgrounded. Check the tap destination. Sign in and out and confirm private order updates stop after sign-out while guest announcement consent remains. Confirm account deletion turns notifications off. For admin alerts, sign in as an enrolled admin, enable notifications and place a deliberate new order from a customer account. Verify the admin alert and dashboard destination. Also test denied permission, foreground, normally closed app and reconnection. Android force-stop can prevent delivery until the app is opened again.

The local Firebase verification used an FCM validation-only request: it verified credentials/API access without delivering messages. Physical-device delivery still requires the updated backend deployment and an installed, registered APK.
