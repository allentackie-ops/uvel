# Uvel Secrets and Client/Server Boundary Audit

**Audit scope:** Repository source, GitHub Actions workflows, Firebase configuration, client Firebase/payment/AI bridges, Firestore rules, and server-side Functions.

**Credential handling:** No secret values were printed, requested, copied, committed, or included in this report.

## Executive summary

The audit found a critical historical exposure in the mobile AI integration. Provider credential material had previously been embedded in `lib/tryon.ts`, which is client-bundled code, and public CI variables were used to inject AI credentials into Expo builds. Those client-side fallbacks and CI injections have now been removed. The current repository secret scan passes.

The audit also confirmed that payment and webhook credentials are declared through Firebase Functions runtime secrets. The Firestore rules restrict order creation to signed-in buyers and pending orders, while payment status and fulfillment updates are blocked from direct client writes. The backend deployment is still blocked by the Firebase Spark-plan limitation, so these server-side protections are not yet live in production.

## Findings and remediation

| Severity | Finding | Current status |
|---|---|---|
| Critical | Provider credentials were previously present in client-bundled AI code in `lib/tryon.ts`. | Removed from current source. AI client helpers now fail closed and return no credentials. |
| Critical | Historical Git commits contain credential-shaped material related to the former AI integration. | The values are not repeated. Rotate affected provider credentials in their provider dashboards and consider a separate history purge after rotation. |
| High | OTA and iOS workflows previously injected AI credentials through `EXPO_PUBLIC_*` variables, which are intended for client-visible build configuration. | Removed from `.github/workflows/ota.yml` and `.github/workflows/ios.yml`. |
| Medium | No automated repository secret guardrail existed. | Added `scripts/scan-secrets.mjs`, exposed as `npm run security:secrets`, and added it to OTA, iOS, and Firebase deployment workflows. |
| Medium | Local environment files were not explicitly ignored. | Added `.env` and `.env.*` ignore rules while allowing `.env.example`. |
| Medium | AI client features still make direct-provider calls in some legacy helpers, but they now receive no client credentials and fail closed. | Safe behavior is in place; the durable follow-up is to move those AI operations behind authenticated, rate-limited server Functions. |
| Medium | Rate limiting was not found for checkout, AI analysis, uploads, attribution, or other expensive request paths. | Remaining hardening item. |
| Informational | `app.json` and `GoogleService-Info.plist` contain Firebase application configuration. | Firebase client configuration such as project identifiers and client API keys is not an admin secret; privileged credentials must remain in Functions runtime secrets. |

## Confirmed server boundary controls

Firebase Functions declare `STRIPE_SECRET`, `PAYSTACK_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PAYSTACK_WEBHOOK_SECRET` with `defineSecret`. The payment callable reads those values only at runtime. Webhook handlers validate signatures server-side. The brand-review callable also declares the Anthropic secret as a Function secret.

Firestore rules allow client order creation only when the buyer is signed in, the buyer owns the order identity, the order is `pending`, and the total is a positive integer. Direct client order updates and deletes are denied. Trusted payment status, fulfillment, payout, analytics, campaign, promotion, and attribution writes are intended to go through backend code.

## Remaining actions before live payments or AI

First, rotate the provider credentials that appeared in historical commits. Do not send replacement values through chat. Second, upgrade Firebase project `uvel-32d32` to Blaze and deploy the Functions and Firestore rules. Third, add authenticated server-side AI endpoints with rate limits and input/file-size limits. Fourth, perform adversarial tests for forged totals, unauthorized reads/writes, duplicate webhooks, replayed attribution events, oversized uploads, and high-frequency requests.

This audit does not claim that live checkout, trusted webhooks, remote analytics, promotions, attribution aggregation, or server-side AI are currently deployed. The repository changes improve the boundary and fail-closed behavior; the Firebase deployment blocker remains.
