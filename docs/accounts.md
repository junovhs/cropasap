# Accounts and the mailing list

Operator notes for the optional account (DEC-05). User-facing wording lives in
`src/docs-content.ts` under `account` and `privacy`.

## Where accounts live

CropASAP uses the **shared Strange Systems Supabase project** —
`fhedwkbaujiivemneefg` — the same one behind No Ceremony and AIfoodpal. One
login works across all three apps, and `auth.users` is one list of people. The
browser-safe URL and publishable key are committed in `src/supabase.ts`; a build
can point elsewhere with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

Nothing is loaded for a guest: `@supabase/supabase-js` is split into its own
chunk (`dist/src/chunks/`) and fetched only on Sign in, a stored session, or an
emailed link. Guest pages make no request after load — the privacy docs say so,
so keep it true.

## Consent

The marketing box is unchecked, worded separately from the account, and stored
in the user's auth metadata (`src/consent.ts`):

| key | value |
| --- | --- |
| `marketing_opt_in` | `true` / `false` |
| `marketing_opt_in_at` | ISO time of the tick, `null` when off |
| `marketing_source` | `cropasap` |
| `marketing_consent_text` | the sentence they ticked |

The person can change it any time from **Your account**. Export the list from
the SQL editor:

```sql
select email,
       raw_user_meta_data->>'marketing_opt_in_at' as opted_in_at,
       raw_user_meta_data->>'marketing_source'    as source
from auth.users
where raw_user_meta_data->>'marketing_opt_in' = 'true'
  and email_confirmed_at is not null
order by opted_in_at;
```

Only ever mail confirmed addresses, and honour the box: an unticked box is an
unsubscribe.

## Dashboard state (checked 2026-09-13)

Done, and verified in production:

- **Redirect URLs** (Authentication → URL Configuration) include
  `https://cropasap.vercel.app/` and `https://cropasap.vercel.app/**`. A
  confirmation link now lands on CropASAP, not the project's site URL
  (AIfoodpal). Add any custom domain the same way.
- **Size sync migration** applied; `public.cropasap_sizes` and
  `cropasap_save_sizes` exist and refuse `anon` (checked over REST).
- **Email templates** are the Supabase defaults and name no product.

Still open:

1. **Custom SMTP** (Authentication → Emails → SMTP Settings) is off, so the
   built-in mailer's few-messages-per-hour limit applies and a launch day will
   show "Try again in a few minutes" to most sign-ups. Resend and Postmark
   need a sending domain you control — `vercel.app` cannot be verified — so
   this waits on a domain. Templates are also locked until SMTP is set.
2. **Scanner-proof links.** See below; needs the template edit, so also waits
   on SMTP.
3. **Test account.** `jgary2110+cropasap-test@gmail.com` exists from the live
   test (confirmed, opted in). Delete it from Users before exporting the list.

## Verified live (2026-09-13, Chrome + Firefox against cropasap.vercel.app)

Sign-up sent the confirmation email; the account card read "Synced"; a pin
made in one browser appeared in the other after sign-in; the first sign-in on
the second browser merged its guest pin into the account (both pins in both
browsers); an unpin in one browser removed it in the other; signing out put the
second browser's own guest pin back. Consent metadata carried the four keys
above with the exact wording. Password sign-in worked on both.

### Gmail opens the link first

Gmail's link scanner fetched the one-time confirmation link 24 seconds after
it was sent. That fetch confirmed the account and spent the token, so the
person's own click landed on
`/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`.
The account is fine; the app (since ACCT-03) explains this and puts the
sign-in form up, and password sign-in succeeds. The proper fix, once SMTP
unlocks templates, is a confirmation link that carries `{{ .TokenHash }}` to
the app, which then calls `verifyOtp` on a human action — a scanner's fetch
cannot spend that.

## Size sync

Saved and pinned sizes live in `public.cropasap_sizes`, one revisioned JSON row
per account (`src/size-sync.ts`). Apply the migration once, either with the
CLI from a linked checkout —

```sh
supabase db push
```

— or by pasting `supabase/migrations/20260914000000_create_cropasap_sizes.sql`
into the SQL editor. Until it is applied the account card says "Sync is not set
up on the server yet" and sizes stay on the device; nothing else changes.

How it behaves: the first sign-in on a device merges what the guest had into
the account (union by pixels); after that the account's copy is adopted on
sign-in, every local change pushes, and a lost race pulls, merges and pushes
again. Signing out puts the guest's own sizes back.
