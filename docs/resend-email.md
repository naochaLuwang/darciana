# Resend email

Password resets use Supabase Auth with Resend SMTP. Order receipts and status emails use the Resend HTTPS API on the Next.js server. Neither the API key nor SMTP password belongs in the browser or Android bundle.

## Server setup

The owner confirmed `dacianastore.in` is verified in Resend. The sender is **Daciana <noreply@dacianastore.in>**; replies go to `luwangtech0@gmail.com`. The CSV export contained a masked key and cannot authenticate. The full sending key is stored only in the ignored `.secrets/resend.env` and `.env.local`.

Run `node scripts/prepare-resend.mjs` after saving the full key. Add the following from `.secrets/resend.env` to the website host's server environment:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`

Keep `SUPABASE_SECRET_KEY` and `ORDER_PUSH_WEBHOOK_SECRET` configured too. Do not prefix private variables with `NEXT_PUBLIC_` or `VITE_`. Deploy the current Next.js source, including `/api/email/order-update`, the password pages and callback changes. The mobile secret scanner checks for the Resend key.

When pasting into a dashboard field, paste the value without the `VARIABLE=` prefix or surrounding quotation marks. SMTP password is only the full API key.

## Supabase SMTP

In Supabase **Authentication → Email → SMTP Settings**, enable custom SMTP:

| Setting      | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Sender email | `noreply@dacianastore.in`                              |
| Sender name  | `Daciana`                                              |
| Host         | `smtp.resend.com`                                      |
| Port         | `465`                                                  |
| Username     | `resend`                                               |
| Password     | Full `RESEND_API_KEY` value from `.secrets/resend.env` |

Save the settings. This routes Supabase authentication emails, including signup confirmation and password recovery, through Resend. The available database server key cannot change hosted Auth SMTP configuration, so this step requires the project dashboard. Keep provider rate limits in mind and review Supabase Auth email limits for the expected traffic.

Under the **Reset password** email template, use subject **Reset your Daciana password** and the contents of `supabase/email-templates/recovery.html`. Keep `{{ .ConfirmationURL }}` intact: it carries the one-time recovery token, the requested callback and PKCE verification. Disable click tracking for authentication links in Resend to avoid rewriting them.

The existing allowed callbacks remain `https://dacianastore.in/auth/callback` and `com.luwangtech.daciana://auth/callback`. No additional production redirect URL is required. Resets must open on the originating device/browser because the PKCE verifier is stored there. Browser requests use cookies; Android uses encrypted storage. A verified recovery callback grants 15 minutes to choose a new password. Matching password confirmation and at least eight characters are required. After success the grant is cleared and sessions are signed out; the customer signs in again.

## Automatic order emails

After the admin setup, run `node scripts/prepare-resend.mjs` to regenerate the ignored `.secrets/email-setup.sql`, then run the entire file in the Supabase SQL Editor before deploying the new server. Existing installations must rerun it too: the upgrade adds recipient/audience history, supports all fulfilment stages, and a service-only admin recipient lookup. The source upgrade is `supabase/order-email-setup.sql`; it is safe to rerun. It adds service-only delivery history and an asynchronous hook for future order inserts and actual status changes. It reuses the existing Vault webhook secret, does not send historical orders and does not change profiles, catalog, prices or order snapshots.

Both website and native checkout are covered. New orders and actual changes to request received (`awaiting_confirmation`), confirmed, processing, shipped, out for delivery, delivered, completed and cancelled send separate messages to the customer and every current admin with a verified Auth email. Payment-only updates do not send an email. Customer recipients come from the order owner's confirmed Supabase Auth email. Admin recipients come from `private.storefront_admins` joined to verified Auth accounts, checked afresh for each event; removing admin membership stops future alerts. Caller-supplied recipients, shipping email fields and user-editable role metadata are never trusted. Only the server service role can call the recipient lookup.

Customer and admin delivery have independent keys and history, so a missing customer email or one failed recipient does not block the others. Existing customer keys are preserved. Admin messages use an `[Admin]` subject prefix, operational wording and a direct authenticated admin order link. Customer messages link to their account. No recipient sees another recipient's address.

The responsive HTML uses presentation tables and inline styles, an inbox preview, a product table with variant subrows, quantities and whole-rupee amounts, delivery charges, saved totals, the placed date in IST and the recorded payment status/method. Paid is shown only when explicitly recorded; old orders with no payment status say “Not recorded”. Unknown delivery/final totals are clearly marked without inventing charges. There is a matching plain-text version, and all dynamic HTML text is escaped. Phone numbers and street addresses remain outside emails; admins open the order to see contact/delivery details. Desktop and mobile HTML previews can be generated with `node --experimental-strip-types scripts/preview-order-emails.mjs`; this writes local files only and never sends mail.

`Admin → Notifications → Order emails` shows Customer/Admin recipients, the order stage, provider acceptance, failures and skipped emails. “Accepted by Resend” is not a delivery/read receipt. Database event keys permanently deduplicate each order/status/audience/admin account; the provider receives the same idempotency key as additional protection. Unknown sending outcomes are not retried automatically. Investigate failed or stalled rows before a deliberate resend; Resend retains its idempotency keys for only 24 hours.

Scheduling or email failures never undo a valid order or status change. Inspect `net._http_response` for webhook transport failures and the email history for provider results. Keep the support inbox monitored. Account deletion removes linked order records; the delivery history keeps the event key/provider result with the order foreign key cleared and no stored recipient address or email body.

## Verification

Automated tests use mock SMTP/Auth responses and mock Resend HTTP calls; no customer email is sent. Test the full production flow deliberately with a customer test account: request a reset, open it on the same device, set a new password, confirm old links cannot be reused, then sign in. Place a deliberate COD test order, change its status from the dashboard and check customer and admin emails for request received, processing, shipped, out for delivery and delivered (or cancellation before shipping). Confirm a payment-only update does not send another email. Automated tests use mock recipients and provider responses; they also check that anonymous/customer roles cannot enumerate admin addresses, revoked/unverified admins are excluded, and one recipient failure cannot block another. Install the newest Android bundle through the same Play testing track to get the new password-reset screens.

References: [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp), [Supabase password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
