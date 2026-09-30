# Personal Listing Media Review

## Behavior

Personal listing publication is controlled by the Firebase Functions review endpoint. A listing stays off the public floor until photo upload, duplicate-image comparison, the fashion/safety review, and the visual AI-generation estimate have completed.

- The existing Claude Sonnet vision call uses the already-wired `ANTHROPIC_API_KEY` Firebase secret; no separate detector credential is used.
- The model returns a **visual estimate**, not a calibrated forensic probability, and provides a short explanation of the visible cues it relied on. The requested cutoff is applied literally: a score of **0.40 or higher** rejects the photo, and the seller sees the estimate and explanation. Because the score is not calibrated, false positives and false negatives remain possible.
- The classifier is prompted to look for specific structural/image artifacts and not treat polished photography, filters, lighting, or stylized fashion illustrations as AI evidence by themselves.
- Duplicate rejection uses an exact SHA-256 match or a conservative visual match requiring all of: difference-hash distance at most 2/64 bits, structural similarity at least 0.985 on a normalized 32×32 grayscale signature, and aspect-ratio difference no greater than 0.02.
- Exact duplicates are checked before AI calls. Identical photo bytes reuse the model estimate for 30 days. An unavailable or malformed AI result does not publish the item; the seller can retry.
- Listing photos are uploaded to Firebase Storage and sent from Cloud Functions to Anthropic for review; the credential is not sent to the app. Anthropic's current API/privacy terms apply to image processing.
- Existing active listing photos are compared when their Firebase Storage media is readable. Legacy listings still pointing at inaccessible local/device URLs need migration to Storage before they participate in the duplicate index.

## Deployment

The image estimate reuses `ANTHROPIC_API_KEY`, which is already used by the existing policy review. Verify the Firebase project has this secret configured; do not expose its value in app config, source control, or chat. If it is not configured, set it through an administrator's Firebase CLI secret prompt:

```sh
firebase functions:secrets:set ANTHROPIC_API_KEY
```

Then deploy the review callables and tightened listing rules from the project's authorized Firebase environment:

```sh
firebase deploy --only functions:uploadPersonalListingAsset,functions:submitPersonalListingForReview,firestore:rules
```

Firebase deployment runs through the repository's GitHub Actions workflow; secret values are not readable through this session.

## Rollout status: OTA published; backend pending Blaze

On 2026-09-30, the Firebase deploy workflow reached `Configure admin bridge parameters` and stopped before any Firestore rules or Functions were deployed. Firebase reported that project `uvel-32d32` must be on the **Blaze (pay-as-you-go)** plan because `secretmanager.googleapis.com` cannot be enabled on the current plan. [Firebase workflow run](https://github.com/allentackie-ops/uvel/actions/runs/36744760608).

Per the user's direction, the app update was then published to the **production** EAS channel for both platforms, without deploying the backend. **The new personal-listing review flow will not work until the backend callables and rules below are deployed.** OTA workflow run: [36752510448](https://github.com/allentackie-ops/uvel/actions/runs/36752510448).

| Platform | Update group ID | Update ID | EAS update |
|---|---|---|---|
| iOS | `997a4d8a-4a90-4323-9c66-e656a700c934` | `01a0f364-a689-72b5-a933-82118e549fd1` | [View](https://expo.dev/accounts/allentackie/projects/uvel/updates/997a4d8a-4a90-4323-9c66-e656a700c934) |
| Android | `e28301dd-560f-4d0f-bddc-d8a3f5ef82c0` | `01a0f365-b5cc-7cbb-b223-2d4f26ff16de` | [View](https://expo.dev/accounts/allentackie/projects/uvel/updates/e28301dd-560f-4d0f-bddc-d8a3f5ef82c0) |

Both updates used runtime version `1.0.0`, branch `production`, commit `8502a7d96def0b6863cbe5fc746e0700cd9791d0`, and message `Personal listing review and Claude AI image screening`.

After the project has been upgraded to Blaze, deploy the backend from the feature branch:

```sh
gh workflow run firebase-deploy.yml --repo allentackie-ops/uvel --ref fix/social-share-sheet-stable \
  -f only='firestore:rules,functions:uploadPersonalListingAsset,functions:submitPersonalListingForReview'
```

Confirm that workflow succeeds. **The OTA is already live**, so it does not need to be republished unless client code changes. The OTA workflow used the repository's `EXPO_TOKEN` secret.
