# Google sign-in setup

The web app has a **Continue with Google** button on the sign-in and create-account screens. It uses Supabase's cookie-based PKCE flow and the existing `/auth/callback` route. Customers signing in from checkout return to checkout; other sign-ins open Profile. Email/password access remains available.

The current Supabase project already reports Google as enabled. Check the existing Google client before creating or replacing credentials, especially if another app uses this project.

## 1. Open your Google Cloud project

Go to [Google Auth Platform](https://console.cloud.google.com/auth/overview). Select the existing project that owns your OAuth client, or create a project if you do not have one.

Under **Branding**, set the app name to **Daciana** and enter your support and developer contact email. Under **Audience**, use **External** for a customer store. While testing, add the Google accounts you will use under **Test users**. Review **Data Access** and use only the sign-in scopes `openid`, `userinfo.email`, and `userinfo.profile`.

See [Supabase's Google provider guide](https://supabase.com/docs/guides/auth/social-login/auth-google) for the current Google console screens and required scopes.

## 2. Configure the OAuth client

Open **Clients**. Edit the existing client, or choose **Create client → Web application**.

In **Authorized JavaScript origins**, add the origins you actually use:

```text
http://localhost:3000
http://127.0.0.1:3000
https://YOUR_APP_DOMAIN
```

Replace the last entry with the real deployed app origin. These are origins, with no `/auth/callback` path.

In **Authorized redirect URIs**, enter this project's Supabase callback:

```text
https://bcozsouelwdvlkcfxerx.supabase.co/auth/v1/callback
```

Save the client. If you created a new one, keep its **Client ID** and **Client secret** for the next step. [Google's client setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) describes the credential fields.

## 3. Verify the Google provider in Supabase

Open [this project's Authentication providers](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/auth/providers). Select **Google**, confirm it is enabled, and verify the Client ID belongs to the web client above. If configuring a new client, paste the Client ID and Client secret here and save.

Enter Google's secret directly in Supabase. It does not belong in this repository, Next.js environment variables, a Capacitor bundle, or chat. The app continues to use its existing Supabase publishable key; no new npm package is needed.

## 4. Allow the app callback URLs

Open [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/auth/url-configuration).

Set **Site URL** to the deployed app origin, or `http://localhost:3000` while developing only locally. Add the exact URLs you use under **Redirect URLs**:

```text
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
https://YOUR_APP_DOMAIN/auth/callback
```

Google redirects to **Supabase's** `/auth/v1/callback`. Supabase then redirects to **the app's** `/auth/callback`. These are separate settings. Keep the browser on the same host when starting and finishing sign-in so its PKCE verifier cookie is available. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 5. Test in a browser

Run `npm run dev`, open `/account`, and choose **Continue with Google**. Sign in with a configured test Google account. You should return to Profile with a session. Try the same flow from checkout and confirm it returns to checkout with the bag intact. Confirm the account appears under **Authentication → Users** in Supabase.

If Google shows `redirect_uri_mismatch`, compare the Google client's redirect URI with the exact Supabase URL in step 2. If sign-in returns to the wrong site, check Supabase's Site URL and Redirect URLs. If the provider is disabled or the user cancels, the app keeps email/password sign-in available and shows a retry message.

Before opening the store to everyone, review the Google app's publishing status and any requested verification. Google may display the Supabase project hostname during consent until custom auth branding is configured.

## Android and account deletion

The Capacitor Android app now uses a system-browser PKCE flow and an app return link. Add `com.luwangtech.daciana://auth/callback` to Supabase's Redirect URLs, retaining existing web callbacks. The Google Cloud redirect remains the Supabase HTTPS callback above. See the [Android guide](android-app.md) for configuration and testing.

The native account screen supports Google-only deletion by requesting a fresh Google sign-in. Deploy the updated `delete-account` Edge Function: it verifies the caller and signed OAuth authentication timestamp before revoking sessions and deleting the account. Password accounts keep password verification. The web deletion screen still uses the password flow.

Local browser tests simulate Google, validate the PKCE verifier, check checkout return and reject arbitrary redirect targets. They do not log into a real Google account.
