import type { ClosetPiece } from "./wardrobe";

export type BannerStory = {
  title: string;
  subtitle: string;
  color: string;
  gradientColor?: string;
  eyebrow?: string;
  footer?: string;
  pieces: ClosetPiece[];
  detailPieces?: ClosetPiece[];
};

let nextId = 0;
const stories = new Map<string, BannerStory>();

export function keepTodayBannerStory(story: BannerStory): string {
  const id = `today-banner-${Date.now().toString(36)}-${(++nextId).toString(36)}`;
  stories.set(id, story);
  return id;
}

export function getTodayBannerStory(id: string): BannerStory | undefined {
  return stories.get(id);
}

export function releaseTodayBannerStory(id: string): void {
  stories.delete(id);
}
