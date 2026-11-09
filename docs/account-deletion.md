# Account deletion deployment

Both the website's account action and the Android app invoke the Supabase Edge Function named **`delete-account`** in project `bcozsouelwdvlkcfxerx`. An undeployed function returns 404 and the current app reports that account deletion is unavailable. Rebuilding an APK does not deploy the function.

The source is in `supabase/functions/delete-account/`. It verifies the authenticated caller, requires the exact `DELETE` confirmation plus password verification or a recent verified Google OAuth login, revokes sessions and deletes only that caller. Request-supplied user IDs are ignored. Administrative keys are obtained from the Edge Function environment, never from the app.

## Deploy

With a CLI login that has function-deployment access to this project:

```sh
supabase functions deploy delete-account --project-ref bcozsouelwdvlkcfxerx --use-api
```

Keep JWT verification enabled. If Supabase denies the Management API with 403, correct project membership/token permissions or deploy through the project's Edge Functions editor using an authorized dashboard account. A Supabase database secret key is not a CLI personal access token and cannot grant Management API access.

Run `node scripts/prepare-account-deletion.mjs` to generate `artifacts/account-deletion/index.ts`, a single-file dashboard copy of the tested handler and entry point. In the dashboard, create `delete-account`, replace **all** editor content with the **entire generated copy**, keep JWT verification on and deploy. Its first two imports start with `npm:@supabase/supabase-js@2.118.0`; it has no `./handler.mjs` dependency and needs no import map. Pasting only the source entry point omits the handler and its configuration. Do not edit the generated copy independently of the source. Supabase supplies the default project URL and API keys to hosted functions.

## Verify

Live verification completed on 9 November 2026: the deployed function accepts the Android CORS preflight, rejects unauthenticated requests, rejects missing confirmation and an incorrect password, and successfully deletes a disposable authenticated customer. The test confirmed removal of the Auth account, customer profile and saved delivery address, no remaining saved-address or push-device rows, and rejection of session refresh after deletion. The disposable account was removed; existing customers were not changed. Evidence is in `artifacts/account-deletion/live-verification.json`.

Google reauthentication still needs a physical-device check. Its signed-claim, recent-login and caller-isolation checks pass the local tests.

```sh
node scripts/check-account-deletion.mjs
node --experimental-strip-types --test tests/profile.test.mjs tests/native-auth.test.mjs
```

The smoke check uses only public configuration and cannot delete an account. It verifies deployment, Android CORS and rejection of unsigned requests. Unit/database tests verify password and OAuth proof, target isolation, session revocation and dependent profile/address deletion.

Finish with a disposable customer on a phone: save a profile/address, attempt a wrong password (must fail), then delete with the correct password. Verify that account and associated records are removed. Separately test a disposable Google account with fresh OAuth confirmation. Never use the store owner account as a deletion test. The public website `/delete-account` is a separate request page and needs the Next.js deployment too.
