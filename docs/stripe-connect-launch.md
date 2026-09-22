# Stripe Connect launch implementation

Uvel now has a US Stripe path built around **Stripe PaymentSheet** for buyers and **Stripe Connect Express onboarding** for sellers. Expo Sharing remains enabled in `app.json`; the Stripe plugin is additive and does not remove any existing sharing capability.

## Runtime flow

A US buyer creates an order, Uvel creates a server-side PaymentIntent, and the app presents PaymentSheet. The client never supplies the amount to Stripe and never marks an order paid. The signed Firebase Stripe webhook handles `payment_intent.succeeded` and marks the order paid. Seller proceeds remain pending until the buyer confirms delivery or the scheduled release job reaches the two-day release window. A seller then transfers an available balance to a verified Stripe connected account. Standard payouts use the connected account's payout schedule; instant payouts are attempted only when Stripe reports an eligible external account.

Non-US checkout paths continue to use the existing provider routing. The existing local Uvel wallet remains available for internal balance spending.

## Required configuration before live use

Set these Firebase Secret Manager secrets before deploying Functions:

- `STRIPE_SECRET`: Stripe live secret key for the Uvel platform.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the production Connect webhook endpoint.
- Existing Paystack secrets remain required for the non-US Paystack paths.

Set this GitHub Actions repository secret before the native build or OTA publish:

- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key. The Expo build receives it as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` and exposes it through `extra.payments.stripePk`. A publishable key is safe to ship in the client; the secret key is not.

The Stripe platform must have Connect enabled, Uvel's branding configured, the US business profile completed, and a production webhook endpoint pointed at the deployed `stripeWebhook` Firebase function. Subscribe the endpoint to account, payment, transfer, payout, and refund events used by `functions/index.js` and `functions/stripeConnect.js`.

## Buyer UI

`app/checkout/[id].tsx` uses PaymentSheet for US orders. The screen keeps the existing shipping address, delivery, promotion, inventory, and Uvel-wallet checks. After PaymentSheet returns success, the app navigates to the order, but the webhook remains the source of truth for paid state. A missing publishable key produces a clear unavailable state instead of collecting payment through an untrusted fallback.

## Seller UI

`app/wallet.tsx` shows available, pending, and withdrawn balances. For US sellers it replaces manual bank-account fields with Stripe-hosted onboarding. Sellers see whether verification is complete, whether more information is required, and whether payouts are restricted. The withdrawal control offers Standard and Instant modes; the backend checks account eligibility and available balance before creating the transfer.

## Native build requirement

Adding `@stripe/stripe-react-native` and its Expo config plugin changes native iOS and Android projects. This cannot be delivered by OTA alone. Run the iOS EAS build workflow from the intended branch and install the resulting build before testing PaymentSheet or Apple Pay. Expo Sharing is still present and is not replaced by Stripe.

## Safety requirements

All Connect callables are server-side and authenticated. Amounts are read from the Firestore order and stored as integer cents. PaymentIntent, account creation, and seller-transfer requests use idempotency keys. Webhooks must verify `Stripe-Signature` using the raw request body and must be deployed before live checkout. Seller payout status and Stripe IDs are persisted for reconciliation. Refund and dispute operations must be reviewed with the platform's reserve and tax-reporting policy before opening withdrawals broadly.
