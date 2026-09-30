# Personal Listing Media Review

## Behavior

Personal listing publication is controlled by the Firebase Functions review endpoint. The listing stays off the public floor until photo upload, duplicate-image comparison, the existing fashion/safety review, and AI-generated-image detection have completed.

- An image is rejected as AI-generated when AI or Not's `report.ai_generated.ai.confidence` is **0.40 or higher**. The score is documented on a 0–1 scale; the seller-facing message shows the corresponding percentage.
- Duplicate rejection uses an exact SHA-256 match, or a conservative visual match requiring all of: difference-hash distance at most 2/64 bits, structural similarity at least 0.985 on a normalized 32×32 grayscale signature, and aspect-ratio difference no greater than 0.02. Similar garments or merely similar-looking photos are not enough to reject.
- An unavailable detector/review response does not publish the item. The seller is told the review could not be completed and can retry.
- Listing photos are uploaded to Firebase Storage and the AI detector call is made from Cloud Functions; the provider credential is not sent to the app.
- Existing active listing photos are compared when their Firebase Storage media is readable. Any legacy listings still pointing at inaccessible local/device URLs need to be migrated to Storage before they can participate in the duplicate index.

## AI or Not setup

The code calls `POST https://api.aiornot.com/v2/image/sync` with a bearer API key, multipart `image`, and `only=ai_generated` to avoid paying for unrelated reports. Before deploying Functions, set the project secret with an administrator's Firebase CLI:

```sh
firebase functions:secrets:set AIORNOT_API_KEY
```

Use the secret prompt to enter the key; never put the value in app config, source control, or chat. The current service account in this development sandbox has no AI or Not credential and no Firebase CLI is installed, so the integration is code-complete but cannot run in production until the key is set and the Functions/rules are deployed.

Then deploy the two review callables and the tightened listing rules from the project's authorized Firebase environment:

```sh
firebase deploy --only functions:uploadPersonalListingAsset,functions:submitPersonalListingForReview,firestore:rules
```

## Provider notes and sources (checked 2026-09-30)

- [AI or Not image API reference](https://docs.aiornot.com/api-reference/reports-by-modality/image.md): synchronous multipart image endpoint; bearer auth; `ai_generated` report; the `ai` prediction includes `confidence` from 0 to 1. The docs also say the provider's `verdict` is its preferred classification, but Uvel applies the explicitly requested 40% threshold to the documented AI confidence score.
- [AI or Not getting started](https://docs.aiornot.com/setup.md): API key setup and bearer-token use; warns keys must be stored securely.
- [AI or Not API introduction](https://docs.aiornot.com/): describes media as processed and deleted after inference.
- [AI or Not pricing](https://www.aiornot.com/pricing): at review time, the free account page advertised $5 in free credits and 20 image checks; Pro was listed as $5/month with $10 in credits and 500 image checks. Recheck before enabling or scaling; prices and quotas can change. Exact duplicates are rejected before calling the detector. Otherwise, each photo is checked until one crosses the rejection threshold; scanning stops early after a rejection, and identical photo bytes reuse a cached score for 30 days.
- [Sightengine AI-generated-image API](https://sightengine.com/docs/ai-generated-image-detection): considered as an alternative; it also documents a 0–1 `ai_generated` score. Uvel uses AI or Not because it was the service the user had already suggested.
