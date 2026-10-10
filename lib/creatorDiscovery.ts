import type { ClosetPiece } from "./wardrobe";

export type CreatorProfile = {
  id: string;
  name: string;
  photo?: string;
  pieces: ClosetPiece[];
  categories: string[];
  styleLine: string;
};

export function rankCreatorProfiles(pieces: ClosetPiece[], limit = 12): CreatorProfile[] {
  const grouped = new Map<string, ClosetPiece[]>();
  for (const piece of pieces) {
    const id = piece.ownerId || piece.listedByUid;
    if (!id) continue;
    const group = grouped.get(id) || [];
    group.push(piece);
    grouped.set(id, group);
  }
  return [...grouped.entries()]
    .map(([id, creatorPieces]) => {
      const first = creatorPieces[0];
      const categories = [...new Set(creatorPieces.map((piece) => piece.category).filter(Boolean))].slice(0, 2);
      const name = first.ownerName || first.listedByName || first.brand || "Uvel creator";
      const styleLine = categories.length ? `${categories.join(" + ")} edits` : "Curated style edits";
      return { id, name, photo: first.ownerPhoto || first.photo || undefined, pieces: creatorPieces, categories, styleLine };
    })
    .sort((a, b) => b.pieces.length - a.pieces.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}
