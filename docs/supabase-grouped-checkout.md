# Native Supabase grouped checkout

The duo/group checkout flow uses the `supabase-checkout-gateway` Edge Function. It verifies the existing Firebase ID token only as the app's current identity bridge, then reads listings and writes checkout orders and payment records in Supabase. It does **not** call or migrate Firebase checkout data.

## Deploy

From the repository root, deploy the function to the Uvel Supabase project:

```sh
supabase functions deploy supabase-checkout-gateway --project-ref cidmigrozwakdreeqhox
```

Set the server-only Stripe secret before accepting payments:

```sh
supabase secrets set STRIPE_SECRET_KEY=... --project-ref cidmigrozwakdreeqhox
```

The mobile build calls:

```text
https://cidmigrozwakdreeqhox.supabase.co/functions/v1/supabase-checkout-gateway
```

The existing `checkout_orders` and `checkout_payments` tables are reused for new native Supabase records. No Firebase order migration is required.
