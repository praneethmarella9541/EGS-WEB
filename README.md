# The Nucleus — Admin Console (web)

An admin-only web console for the EGS field-operations app, built to be hosted on
Vercel. It talks to the **same Supabase project** as the Expo mobile app — same
tables, same RLS policies, same Edge Functions — so there is no separate backend
and no data migration. Field staff keep using the mobile app; admins get this.

## What's in it

| Route | What it does |
|---|---|
| `/login` | **Google sign-in only.** No password form. |
| `/auth/callback` | Exchanges the OAuth code, stores the Google refresh token, lands in the console. |
| `/overview` | Today at a glance: areas assigned/visited/pending, photos, latest visits. |
| `/assignments` | Pick a date, assign one or many areas per user, optionally override the form per area, remove assignments. Sends the same push notification the mobile app does. |
| `/attendance` | By date or by user: stats, per-area status (visits / pending / no-show), each visit with its GPS provenance line, map link, and photo lightbox with download. |
| `/forms` | Google Forms list — create, delete, copy responder link, star the default "field form". |
| `/forms/[id]` | Full form builder (questions, settings, live preview) plus a responses tab with summaries, verified visit matching, and CSV export. |
| `/team` | Create field users, reset passwords, delete users and all their data. |

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (palette mirrors the mobile app's `constants/theme.ts`)
- `@supabase/supabase-js` on the client; auth session in `localStorage`

## Authentication — Google only

The console signs in with Google and nothing else, using the same provider,
scopes and token handling as the mobile app:

1. `signInWithOAuth({ provider: 'google', … })` with `access_type=offline` and
   `prompt=consent`, requesting `openid email profile` + `forms.body` +
   `forms.responses.readonly` + `drive`.
2. Google → Supabase → back to `/auth/callback?code=…`.
3. That page calls `exchangeCodeForSession(code)` (PKCE), then
   `captureGoogleRefreshToken()`, which POSTs the session's
   `provider_refresh_token` to the `google-link` Edge Function. It lands in
   `google_credentials`, which is what the Forms functions mint access tokens
   from. **The refresh token never touches browser storage.**

The web flow is much shorter than mobile's — no `egscrm://` deep link, no HTTPS
bridge, no callback polling — because the browser is the thing being redirected.

**Roles are decided by the database, not by this app.** `handle_new_user` in
`supabase/schema.sql` gives any `provider = 'google'` signup `role = 'admin'`,
and every admin-created email/password account `role = 'user'`. That is why
Google-only is the right fit here, and why field staff (password accounts) are
bounced out of the console if they somehow get in.

> ⚠️ **Read this before making the URL public.** Because *any* successful Google
> sign-in becomes an admin, the only thing standing between a stranger and full
> admin access is your Google OAuth consent screen. While the Google Cloud
> project is in **Testing** mode, that's the Test-users list and you're fine. If
> it's ever **Published**, anyone with any Google account who finds the URL
> becomes an admin. This mattered less when the only client was a private APK.
> To close it, restrict signups to known emails — for example:
>
> ```sql
> -- in handle_new_user, replace the role expression with:
> v_role := case
>   when v_provider = 'google' and new.email in ('you@yourcompany.com')
>     then 'admin'
>   when v_provider = 'google' then 'user'  -- signed in, but no console access
>   else 'user'
> end;
> ```
>
> Or keep the project in Testing mode and manage the Test-users list.

### Extra setup this needs (one-off)

On top of the existing mobile setup in [`docs/GOOGLE_SETUP.md`](https://github.com/praneethmarella9541/EGS-Mobile/blob/main/docs/GOOGLE_SETUP.md)
in the mobile repo:

- **Supabase → Authentication → URL Configuration → Redirect URLs** — add both:
  - `http://localhost:3000/auth/callback`
  - `https://<your-vercel-domain>/auth/callback` (and any preview domain you'll
    actually sign in on)
- Google Cloud's **Authorized redirect URIs** need no change — it still points at
  `https://<PROJECT-REF>.supabase.co/auth/v1/callback`; Supabase does the final hop.
- The consent screen must already list the `drive` scope (the mobile app uses the
  same one), otherwise the Forms tab can't list existing forms.

## Why there's no server code

Every screen reads and writes through the browser Supabase client using the
signed-in admin's JWT:

- **RLS** already grants admins full access to `profiles`, `assignments`,
  `location_visits`, `visit_photos`, `forms` and `app_settings`.
- **Edge Functions** (`admin-users`, `google-forms`, `gcs-sign`,
  `notify-assignment`) re-check the caller's role server-side and already send
  `Access-Control-Allow-Origin: *`, so the browser can call them directly.

The route guard in `src/app/(console)/layout.tsx` is therefore UX, not security —
a non-admin who bypassed it would still be refused by RLS and by every function.

## Shared code

These files are copied verbatim from the mobile app so both clients stay in sync;
if you change one, change both:

`google-forms-editor-model.ts`, `form-responses.ts`, `visit-match.ts`,
`admin-users.ts`, `forms.ts`, `forms-api.ts`, `settings.ts`, `assignments.ts`,
`notify.ts`, `types.ts`, `google-credentials.ts`.

`supabase.ts`, `edge.ts`, `visits.ts`, `forms-actions.ts` and `google-sign-in.ts`
are web rewrites of their mobile counterparts (browser storage, `fetch`, blob
downloads, clipboard, plain redirect OAuth).

## Run locally

```bash
cp .env.example .env.local   # same two values the mobile app's .env.local uses
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` and `npm run typecheck` both need to pass before deploying.

## Deploy to Vercel

1. Push this repo to GitHub, then **New Project** in Vercel and import it.
2. Set **Root Directory** to `web` — this is the one setting that matters, since
   the repo root is an Expo app. Framework preset auto-detects as Next.js.
3. Add two environment variables (Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy, then add the deployed URL's `/auth/callback` to the Supabase redirect
   allowlist (see "Extra setup" above) — sign-in fails until you do.

Beyond that redirect entry nothing needs configuring: Supabase requires no
allowed-origins list, and the Edge Functions already allow any origin.

Both values are the project URL and the **anon** key, which are designed to be
public; the service-role key is never used here.

## Notes / differences from the mobile app

- Response summaries are single-hue horizontal bars rather than the multi-colour
  pie the mobile app draws — they stay readable past a handful of options and
  don't depend on colour alone to tell categories apart.
- There is no email/password sign-in here at all. That path still exists in the
  mobile app, which is where field users belong.
- Editing a team member is password-only, matching the mobile app's edit form.
  Email, display name and mobile are set at creation.
- The "verified visit details" setting is still read (and drives the Responses
  tab), but has no toggle in the UI — same as the mobile app, which hides it.
