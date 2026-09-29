/** Keep feed work bounded and avoid creating large duplicate arrays. */
export const FEED_PAGE_SIZE = 50;

/**
 * A scarce listing is currently a listing with one unit or fewer available.
 * Listings without inventory metadata are not treated as scarce.
 */
export function isScarceListing(piece: { stockQuantity?: number }) {
  return typeof piece.stockQuantity === "number" && piece.stockQuantity <= 1;
}

function seededShuffle<T>(items: T[], seed: number, pass: number, page: number) {
  const shuffled = [...items];
  let state = (seed ^ Math.imul(pass + 1, 0x9e3779b1) ^ Math.imul(page + 1, 0x85ebca6b)) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

/**
 * Returns one bounded page. Normal listings retain their ranked order. Only
 * scarce listings move, and each listing appears once per pass before the
 * next pass starts.
 */
export function feedPage<T extends { id: string; stockQuantity?: number }>(items: T[], pageOrdinal: number, seed: number) {
  if (!items.length) return [] as T[];
  const pageCount = Math.ceil(items.length / FEED_PAGE_SIZE);
  const page = pageOrdinal % pageCount;
  const pass = Math.floor(pageOrdinal / pageCount);
  const pageItems = items.slice(page * FEED_PAGE_SIZE, (page + 1) * FEED_PAGE_SIZE);
  const scarcePositions: number[] = [];
  const scarceItems: T[] = [];

  pageItems.forEach((item, index) => {
    if (isScarceListing(item)) {
      scarcePositions.push(index);
      scarceItems.push(item);
    }
  });

  if (scarceItems.length < 2) return pageItems;
  const shuffledScarce = seededShuffle(scarceItems, seed, pass, page);
  const result = [...pageItems];
  scarcePositions.forEach((position, index) => {
    result[position] = shuffledScarce[index];
  });
  return result;
}

/** Resolve an endless-feed index without materializing the entire feed. */
export function feedItemAt<T extends { id: string; stockQuantity?: number }>(items: T[], index: number, seed: number) {
  if (index < 0 || !items.length) return undefined;
  // Wrap by the real catalog length before resolving the bounded page. This
  // keeps 1-, 10-, and 50+ listing catalogs truly endless without reading
  // past the end of a short final page.
  const pass = Math.floor(index / items.length);
  const logicalIndex = index % items.length;
  const pageCount = Math.ceil(items.length / FEED_PAGE_SIZE);
  const pageOrdinal = pass * pageCount + Math.floor(logicalIndex / FEED_PAGE_SIZE);
  const page = feedPage(items, pageOrdinal, seed);
  return page[logicalIndex % FEED_PAGE_SIZE];
}
