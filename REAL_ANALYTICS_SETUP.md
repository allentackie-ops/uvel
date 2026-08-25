# Real brand analytics setup

The brand analytics dashboard now reads from server-maintained Firestore rollups. It no longer generates figures locally. New metrics begin at zero and only increase from authenticated analytics events and payment-provider confirmations after this setup is completed.

## What is recorded

Brand and listing views are recorded through authenticated callable functions. A visitor’s brand view is counted once per event, while the unique audience count is deduplicated by authenticated user. Listing likes, unlikes, follows, and unfollows update server-side counters. Listing documents are synchronized to Firestore so live inventory can be joined to a brand.

Sales and earnings are recorded only when the server receives a valid payment webhook. Earnings are defined as the item amount minus the stored Uvel fee, excluding shipping and tax. Values are stored by currency; the dashboard requests the brand’s active market currency.

## Required deployment

From the repository root, install the Firebase Functions dependencies and deploy the Functions and Firestore rules:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

The deployment must expose these HTTPS endpoints:

```text
https://<region>-<firebase-project>.cloudfunctions.net/stripeWebhook
https://<region>-<firebase-project>.cloudfunctions.net/paystackWebhook
```

## Required secrets

Set the payment-provider webhook signing secrets in the Firebase project. Do not put them in the mobile app or commit them to Git:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set PAYSTACK_WEBHOOK_SECRET
```

The existing `STRIPE_SECRET`, `PAYSTACK_SECRET`, and `ANTHROPIC_API_KEY` secrets remain server-side secrets. Redeploy Functions after changing a secret.

## Provider dashboard configuration

In Stripe, create a webhook endpoint for `/stripeWebhook` and subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Stripe’s official guidance requires server-side webhooks for reliable fulfillment: https://docs.stripe.com/checkout/fulfillment.

In Paystack, create a webhook endpoint for `/paystackWebhook` and enable successful charge notifications. Paystack signs webhook requests with the `x-paystack-signature` header. Verify the exact dashboard configuration and test delivery in the Paystack dashboard before accepting production payments: https://paystack.com/docs/payments/webhooks/.

## Important behavior

The checkout now creates a pending order before opening hosted payment. Returning from the hosted payment page does not mark the order paid. The order screen remains in “Payment submitted” state until the provider webhook changes the order to `paid`. The webhook then marks the synchronized listing sold and increments the brand’s server-side sales and earnings rollups atomically.

Legacy local/demo analytics are intentionally not migrated. Existing figures are ignored by the new dashboard; the new Firestore rollup documents start at zero. Historical sales can only be added through a separately audited backfill from provider settlement records, not by copying the old synthetic values.
