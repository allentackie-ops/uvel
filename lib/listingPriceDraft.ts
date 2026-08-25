let pending: { key: string; price: string } | null = null;

export function setPendingListingPrice(key: string, price: string) {
  pending = { key, price };
}

export function takePendingListingPrice(key: string) {
  if (!pending || pending.key !== key) return undefined;
  const value = pending.price;
  pending = null;
  return value;
}
