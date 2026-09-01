# Uvel Brand Feature Audit

## Scope reviewed

The audit covered brand application and Uvel review, public brand pages, Brand HQ, catalog and listing, team invitations and roles, Founder Studio, analytics, campaign attribution, marketing persistence, support, payouts, audit history, and Brand Studio media.

## Fixes implemented in this pass

| Area | Change | Result |
|---|---|---|
| Brand review | Review submissions now pass the owned brand ID to the backend; the backend validates ownership and persists `verified`, `reviewStatus`, rejection reasons, and timestamps. | Verification state is no longer only device-local when the Functions backend is available. |
| Team invitations | Added `acceptBrandInvite`, with account matching, transactional member insertion, invite state update, and audit logging. | Joining a team persists across devices and cannot be accepted by the wrong account. |
| Team roles | Added `updateBrandTeam` and routed Brand HQ role changes through it. | Role changes and removals use server-side owner/admin authorization and update `memberIds`. |
| Brand hydration | Replaced unrestricted collection reads with authenticated queries for verified brands, owned/member brands, and sent/received invites. | A denied document should no longer make the whole remote sync fail. |
| Brand catalog | Brand List now calls the role-checked catalog callable; Firestore generic listing writes exclude brand listings. The callable supports direct listed creation after validation. | A viewer cannot create brand catalog products by bypassing the UI. |
| Brand media | Added `uploadBrandAsset`; Brand Studio now uploads logo/banner media through a trusted callable to the configured Firebase Storage bucket and stores signed URLs. | Media can be durable and cross-device after Functions and Storage rules are deployed. |

## Remaining limitations and production dependencies

Founder Studio remains deliberately private and device-local, matching the current product constraint. Marketing, support, audit, and some brand caches still have local fallback behavior when Firebase is unavailable; the UI should be treated as offline/prototype state in that condition.

The repository documentation describes a fuller `brandReviewCases` / evidence / human-admin workflow, but those collections and admin workspace are not implemented in the current code. The current automated review can persist a result, but it is not a substitute for a deployed human-review queue, private evidence storage, or official source screening.

Payout profile submission and payout requests are secured callables, but payment-provider onboarding and payout processing remain external operational dependencies. A successful request record is not the same as a completed provider payout.

The new backend callables and rules must be deployed to Firebase before the mobile client can use the new durable paths in production. The local TypeScript check still reports three pre-existing unrelated errors in `app/(tabs)/find.tsx`, `app/brand/apply.tsx`, and `components/BrandBanner.tsx`; no new TypeScript errors were introduced by this audit patch. The backend entrypoint loads successfully, the security scan passes, and `git diff --check` passes.
