# Parked app experiences

The launch build is focused on shopping and standard seller listings. The former Create tab and brand-entity workflows are retained here so they can be restored later without deleting their source:

- `archive/(tabs)/create.tsx` — full former Create tab implementation.
- `archive/brand/` — former brand application, profile, team, studio, marketing, and HQ routes.
- `archive/components/` — founder-notice and brand-promotion presentation components used by the parked routes.

The matching files under `app/(tabs)/create.tsx` and `app/brand/` are small Expo Router redirects. They keep old deep links and typed route references safe while sending users back to Today. Standard `app/sell.tsx`, listing drafts, product data, seller records, and order/checkout data remain active; this change does not migrate or delete backend records.
