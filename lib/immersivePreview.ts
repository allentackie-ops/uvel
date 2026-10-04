import type { ClosetPiece } from "./wardrobe";

let previewPiece: ClosetPiece | null = null;

export function setImmersivePreview(piece: ClosetPiece) {
  previewPiece = piece;
}

export function takeImmersivePreview() {
  const piece = previewPiece;
  previewPiece = null;
  return piece;
}
