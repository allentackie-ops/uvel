import type { ClosetPiece } from "./wardrobe";

/**
 * Returns the subject-only asset for editorial Today compositions.
 *
 * `cutoutPhoto` is expected to be a transparent PNG/WebP generated from the
 * original listing photo. The original photo remains the fallback so older
 * listings continue to render until a cutout is available.
 */
export function todayProductImage(piece?: Pick<ClosetPiece, "photo" | "cutoutPhoto">, fallback = "") {
  return piece?.cutoutPhoto || piece?.photo || fallback;
}
