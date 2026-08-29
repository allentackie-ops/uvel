# Founder Studio Phase 6 — Firebase Audit

## Current deployment shape

The repository has Firebase configuration for Firestore rules, Firestore indexes, Storage rules, and Cloud Functions under `functions/`. No `.firebaserc` project-target file is present in the checked-out repository, so deployment targeting appears to be supplied externally or from another environment.

The package currently uses Expo SDK 57-era dependencies, Firebase client SDK 12, AsyncStorage, and Expo Router. The existing backend contains callable/request handlers for marketplace operations and audit logging, but the Phase 6 admin review/evidence flow is not yet confirmed as implemented.

## Security findings

Firestore is intentionally deny-by-default at the fallback match. Existing marketplace documents generally allow reads for authenticated owners, brand members, buyers, or sellers, while creates/updates are often disabled from the client so trusted backend code controls state transitions. Orders explicitly prevent client updates to payment and fulfillment state. Chats restrict participant access and limit mutable fields.

Storage currently allows a signed-in user to read/write image files under their own `/users/{uid}` path with a 10 MB image constraint. Brand paths are publicly readable but all brand writes are disabled pending a trusted backend path that verifies brand ownership or membership. There is no confirmed private evidence-storage path yet.

## Phase 6 implications

The safest first implementation is backend-contract and admin-workspace preparation without pretending that Spark supports production-grade moderation infrastructure. Admin authorization must be enforced server-side with custom claims or an equivalent trusted role check; hiding an admin screen in the mobile client is insufficient. Review cases should be separate from public brand documents, with immutable audit events and explicit status transitions. Evidence must be private by default and accessed through a trusted, time-limited mechanism once the project is upgraded to support it.

Public-source screening should record source URLs, timestamps, provider status, and the difference between an automated signal and a human decision. It must not turn an unavailable provider into a positive or negative verification result. The public application handoff should pass project data to the application form, but publication and verification must remain separate backend-controlled actions.

## Blockers and prerequisites

1. Confirm the Firebase project target and deployment credentials outside the repository.
2. Confirm whether the Firebase project is still on Spark; Storage rules and callable functions can be prepared, but secure evidence upload, admin workflows, and external screening need backend deployment and likely Blaze billing.
3. Add a server-side admin-role mechanism and test it with the Firebase Emulator Suite or a controlled project.
4. Add private evidence data models and a trusted upload/download path before exposing document uploads in the mobile UI.
5. Keep all unavailable integrations visibly marked as unavailable or pending rather than returning invented analytics or verification outcomes.
