export const SHARED_LISTING_PREFIX = "uvel_shared_listing:";

export type SharedListingKind = "closet" | "catalog";
export type SharedListingRef = { id: string; kind: SharedListingKind; name: string; brand: string; priceCents: number; currency?: string; message?: string };
export type SharedListingShare = SharedListingRef & { photoUri?: string };

export function parseSharedListing(text: string): SharedListingRef | null {
  if (!text.startsWith(SHARED_LISTING_PREFIX)) return null;
  try {
    const value = JSON.parse(text.slice(SHARED_LISTING_PREFIX.length)) as SharedListingRef;
    return value?.id && (value.kind === "closet" || value.kind === "catalog") && typeof value.name === "string" && typeof value.brand === "string" && Number.isFinite(value.priceCents) && (value.message === undefined || typeof value.message === "string") ? value : null;
  } catch {
    return null;
  }
}

export function sharedListingPayload(item: SharedListingShare, message?: string) {
  const { id, kind, name, brand, priceCents, currency } = item;
  const note = message?.trim();
  return `${SHARED_LISTING_PREFIX}${JSON.stringify({ id, kind, name, brand, priceCents, currency, ...(note ? { message: note } : {}) })}`;
}
