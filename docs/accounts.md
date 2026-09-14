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

## Dashboard settings that must be right before launch

1. **Redirect URLs** (Authentication → URL Configuration). Add
   `https://cropasap.vercel.app/` and `https://cropasap.vercel.app/**`, plus any
   custom domain. Without them, confirmation and reset links send people to the
   project's site URL, which is AIfoodpal.
2. **Email sending.** The project is on Supabase's built-in mailer, which
   allows only a few messages per hour — a sign-up during testing already hit
   `over_email_send_rate_limit`. Before a launch, configure custom SMTP
   (Authentication → SMTP Settings; Resend, Postmark, etc.) or a Product Hunt
   day will produce "Try again in a few minutes" for most sign-ups.
3. **Email templates.** They are shared across the apps; make sure the
   confirmation and recovery templates do not name one product.

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
