# Uvel admin report bridge

The Uvel Functions code now exports three Firestore v2 triggers:

- `syncFeedbackToAdminPortal` on `feedback/{feedbackId}` creation;
- `syncSupportCaseToAdminPortal` on `supportCases/{caseId}` writes;
- `syncBrandReviewToAdminPortal` on `brands/{brandId}` writes when review fields change.

Each trigger sends a normalized, idempotent record to the admin portal endpoint:

```text
POST {UVEL_ADMIN_PORTAL_URL}/api/integrations/uvel/reports
x-uvel-bridge-token: {UVEL_ADMIN_BRIDGE_SECRET}
```

## Required Firebase configuration

Use a **stable published HTTPS URL** for the admin portal. Do not use the temporary sandbox preview URL. Then configure the Firebase Functions parameters:

```bash
firebase functions:secrets:set UVEL_ADMIN_BRIDGE_SECRET --project uvel-32d32
```

The current trigger code uses the v2 parameter `UVEL_ADMIN_PORTAL_URL`. On the first deployment, Firebase CLI will prompt for the stable portal URL and save it to the generated `functions/.env.uvel-32d32` file. Keep that file out of source control unless your deployment policy explicitly allows it. The secret value must exactly match the server-only `UVEL_BRIDGE_SECRET` value configured on the admin portal. Firebase’s current parameterized configuration and Secret Manager flow is used; the deprecated `functions.config()` path is not used.

Deploy from `main` after both values are configured:

```bash
firebase deploy --project uvel-32d32 --only functions
```

The GitHub Actions workflow now deploys `firestore:rules,functions` on pushes to `main`, while manual runs continue to honor the selected target.

## Safety notes

The bridge secret is never placed in the mobile app, browser bundle, or repository. Portal writes are rejected with `401` without the token. Report IDs are stable, so retries update the existing portal record instead of duplicating it. The admin portal records a bridge ingestion audit event for every accepted report.
