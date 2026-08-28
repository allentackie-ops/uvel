# Uvel Brand Review and Admin Workspace

## Purpose

Uvel needs a governed review system that helps new founders enter safely without presenting an AI judgment as a legal conclusion. The system should separate four different ideas:

1. **Founder project:** a private workspace for someone developing a brand before it is ready for public selling.
2. **Uvel review:** an internal marketplace-safety and authenticity review of a public brand application.
3. **Human escalation:** an admin-managed review when automated signals are uncertain, disputed, or potentially consequential.
4. **Payout verification:** identity and business checks required by the payment provider before funds can be paid out.

The Uvel check must not be described as a government registration check, trademark clearance, ownership determination, product-quality certification, or payout approval.

## Recommended product flow

### 1. Founder starts privately

A person can create a Founder project with a working name, handle, country, story, moodboard, sketch canvas, and draft products. This project is private by default. It does not receive a public blue check and does not appear in the brand directory.

The founder can later convert the project into a brand application. Conversion should copy the approved public fields but retain the private project history separately.

### 2. Brand submits for Uvel review

The application collects only what is needed for marketplace safety and contactability:

- Public brand name and handle.
- Legal or operating name as appropriate to the applicant’s business stage.
- Country and business type: individual/sole proprietor, unincorporated team, or incorporated business.
- Story and fashion vertical.
- At least one reachable brand contact.
- Optional website and social handles.
- Optional registration or tax identifier.
- Optional supporting documents when the applicant disputes a conflict or requests stronger review.

The first submission creates a `brandReviewCases` record and changes the public brand state to `review_pending`. It should not immediately display a strong “verified” claim.

### 3. Automated screening runs server-side

A backend job or callable function creates a review snapshot and records:

- Exact and normalized name matches.
- Handle/name similarity.
- Known impersonation patterns.
- Public-source search results from relevant trademark and business registries.
- Website and social links supplied by the applicant.
- AI-generated risk categories and confidence.
- Source URLs, jurisdiction, search date, and provider response status.

The system should screen first and decide second. A trademark search result is evidence of a possible conflict, not a conclusion that a name infringes or is unavailable. The USPTO provides official federal trademark search tools [1]. WIPO’s Global Brand Database includes Madrid System marks and participating national or regional collections, while WIPO advises that national or regional registers may also need to be searched [2]. EUIPO directs users to official databases such as TMview and eSearch plus and publishes API products for trademark search and information [3].

### 4. AI returns a triage outcome

The AI output is structured and limited to triage:

```text
risk: clear | needs_information | possible_conflict | impersonation_risk | prohibited_content | unavailable
confidence: low | medium | high
reasons: short, evidence-linked explanations
recommended_action: approve_for_human_confirmation | request_information | human_review | reject_under_policy
```

The model must not return “legally infringes,” “trademark is owned by,” “business is registered,” or equivalent legal conclusions. The backend should reject malformed or overconfident outputs and retain the source evidence separately from the model narrative.

### 5. Human review goes to the admin workspace

Cases should enter the internal queue when any of the following is true:

- The applicant disputes an automated flag.
- The system finds a possible trademark or impersonation conflict.
- The applicant submits supporting documents.
- The confidence is low or sources disagree.
- A prior rejection is appealed.
- The account shows repeated or coordinated abuse signals.

The admin workspace should show the applicant’s submitted information, public-source results, AI reason codes, uploaded evidence, prior decisions, related brands, and an audit timeline. An admin must be able to request more information, approve the Uvel review, reject under a published marketplace policy, escalate, or mark the case as legally uncertain.

### 6. Applicant can appeal with documents

The applicant-facing appeal flow should be explicit:

> “We found a possible conflict or could not confirm enough information. If you believe this is wrong, submit documents or links that show your relationship to the brand. Uvel will review the submission. This does not guarantee approval.”

Evidence should be uploaded to a private storage path such as:

```text
brand-review-evidence/{brandId}/{caseId}/{evidenceId}
```

Evidence metadata should include the uploader UID, case ID, document type, file hash, MIME type, size, created time, and review status. Government IDs, tax records, incorporation documents, and ownership documents must never be stored in a public bucket or exposed to ordinary brand members.

### 7. Separate public labels from payout status

Use explicit states rather than one overloaded `verified` boolean:

| Layer | Suggested state | Meaning |
|---|---|---|
| Founder project | `building` | Private preparation workspace; no public brand claim |
| Uvel review | `not_started`, `review_pending`, `needs_information`, `human_review`, `uvel_reviewed`, `rejected` | Internal/public-marketplace review state; not legal certification |
| Payout onboarding | `not_started`, `pending`, `enabled`, `needs_attention`, `unavailable` | Payment provider’s status for receiving funds |
| Public badge | `none` or `uvel_reviewed` | Only shown after the defined Uvel review threshold is met |

A verified payout account should not automatically receive a Uvel authenticity badge. An Uvel-reviewed brand should not automatically be allowed to receive payouts.

## Admin authorization and data security

The admin workspace must use Firebase Authentication custom claims such as `admin: true`, assigned only from a privileged server environment. Firebase documents custom claims as an access-control mechanism enforced through security rules and says they should be set only by the Admin SDK [4]. The client may hide or show UI based on a refreshed token, but every backend callable, Firestore rule, and Storage rule must enforce the admin claim again.

Firestore should restrict review-case reads and decisions to admins, while applicants can read only their own case status and submit permitted evidence. Storage rules should validate authenticated access, path ownership, content type, and file size. Firebase documents Storage Rules as the place to authorize per-path access and validate file metadata such as content type and size [5].

Every admin action should append an immutable audit event with actor UID, action, case ID, previous state, new state, reason code, and timestamp. Admins should not be able to silently edit or delete the evidence or decision history from the mobile client.

## Suggested data model

### `brandReviewCases/{caseId}`

```text
brandId
applicantUid
status: review_pending | needs_information | human_review | uvel_reviewed | rejected
businessType: individual | sole_proprietor | unincorporated_team | incorporated
submittedSnapshot
riskSummary
sourceChecks[]
requestedEvidence[]
assignedAdminUid
createdAt
updatedAt
resolvedAt
```

### `brandReviewEvidence/{evidenceId}`

```text
caseId
brandId
uploadedByUid
storagePath
fileName
contentType
size
sha256
kind: identity | registration | ownership | authorization | trademark | other
status: submitted | accepted | rejected | superseded
createdAt
```

### `brandReviewDecisions/{decisionId}`

```text
caseId
adminUid
action: request_information | approve | reject | escalate | reopen
reasonCodes[]
notes
createdAt
```

### `adminAudit/{eventId}`

```text
actorUid
actorRole
entityType
entityId
action
before
 after
createdAt
```

## Architecture options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **Secure Firebase backend with Admin SDK, Firestore, Storage, and server-side source/AI checks** | Correct long-term architecture; supports real admin accounts, private evidence, audit logs, appeals, and cross-device review. Requires Blaze, backend deployment, provider credentials, and privacy/legal implementation. | Firebase/provider usage varies; payment verification has provider fees. | High, but appropriate for production |
| **Interim local prototype inside the Expo app** | Lets us test the screens and state transitions quickly, but data is device-local, no real admin authorization exists, no secure evidence storage exists, and public-source checks cannot be trusted or run continuously. Must not be presented as production moderation. | Low for prototyping | Low to medium |

The secure Firebase architecture should be the production target. The local prototype is useful only for designing and testing the applicant and admin screens while Firebase remains on Spark. A client-side email allowlist or hidden admin button is not an acceptable substitute for backend authorization.

## Implementation order

### Release 1: secure foundation

1. Add explicit review and payout status fields while preserving compatibility with the existing `verified` field.
2. Create the review-case and evidence data contracts.
3. Add Firebase custom-claim checks in backend functions and rules.
4. Build the applicant status and appeal UI.
5. Build the admin queue, case detail view, decision actions, and audit timeline.
6. Add private Storage paths and evidence metadata validation.

### Release 2: source screening

1. Add server-side connectors for the applicable official trademark sources by country.
2. Store source URL, jurisdiction, retrieval date, query, and response status for every check.
3. Add deterministic exact/normalized matching before AI triage.
4. Use AI only to summarize signals and recommend the next review action.
5. Require human review for possible conflicts, disputes, low-confidence results, and evidence submissions.

### Release 3: payout readiness

1. Start payment-provider onboarding only when Uvel is ready to accept funds.
2. Use hosted provider onboarding where available rather than recreating global KYC/KYB rules.
3. Store provider account status and requirements, not raw identity documents, in Uvel’s ordinary app data.
4. Gate payouts on provider status, independent of the Uvel public badge.

## Current project constraint

Uvel’s Firebase project is still on Spark, and the backend has not been established as a deployed production review service. Therefore the current app can safely show review states and prepare UI contracts, but it cannot honestly claim live server-side trademark screening, secure document review, a real admin account, or durable cross-device moderation until the backend is enabled and deployed.

## References

[1]: https://www.uspto.gov/trademarks/search "USPTO — Search our trademark database"
[2]: https://www.wipo.int/en/web/global-brand-database "WIPO — Global Brand Database"
[3]: https://www.euipo.europa.eu/en/trade-marks/before-applying/availability "EUIPO — Trademark availability"
[4]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase — Control Access with Custom Claims and Security Rules"
[5]: https://firebase.google.com/docs/storage/security "Firebase — Understand Firebase Security Rules for Cloud Storage"
