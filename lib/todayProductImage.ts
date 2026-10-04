import type { ClosetPiece } from "./wardrobe";

/**
 * Returns the subject-only asset for editorial Today compositions.
 *
 * `cutoutPhoto` is expected to be a transparent PNG/WebP generated from the
 * original listing photo. Editorial compositions intentionally do not fall
 * back to the original photograph: a rectangular source photo must never be
 * shown where a subject cutout is required.
 */
export function todayProductImage(piece?: Pick<ClosetPiece, "cutoutPhoto">, fallback = "") {
  return piece?.cutoutPhoto || fallback;
}
