import type { Category } from "./catalog";

export type SizeSystem = "clothing" | "numeric" | "shoes-eu" | "shoes-us" | "onesize" | "rings" | "belts" | "hats";

export const SIZE_SYSTEMS: { id: SizeSystem; label: string; sizes: string[] }[] = [
  { id: "clothing", label: "Clothing", sizes: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"] },
  { id: "numeric", label: "Numeric", sizes: ["0", "2", "4", "6", "8", "10", "12", "14", "16"] },
  { id: "shoes-eu", label: "Shoes EU", sizes: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] },
  { id: "shoes-us", label: "Shoes US", sizes: ["5", "6", "7", "8", "9", "10", "11", "12", "13"] },
  { id: "onesize", label: "One size", sizes: ["One size"] },
  { id: "rings", label: "Rings", sizes: ["5", "6", "7", "8", "9", "10", "11"] },
  { id: "belts", label: "Belts", sizes: ["28", "30", "32", "34", "36", "38", "40", "42"] },
  { id: "hats", label: "Hats", sizes: ["S", "M", "L", "XL"] },
];

export function systemFor(category: Category | string): SizeSystem {
  switch (category) {
    case "Shoes":
      return "shoes-eu";
    case "Jewelry":
      return "onesize";
    case "Watches":
    case "Sunglasses":
    case "Scarves":
    case "Hair":
    case "Bags":
    case "Accessories":
    case "Ties":
    case "Gloves":
      return "onesize";
    case "Hats":
      return "hats";
    case "Belts":
      return "belts";
    case "Dresses":
    case "Skirts":
    case "Lingerie":
    case "Swim":
      return "numeric";
    default:
      return "clothing";
  }
}

export function sizesOf(system: SizeSystem) {
  return SIZE_SYSTEMS.find((s) => s.id === system)?.sizes ?? SIZE_SYSTEMS[0].sizes;
}

export const BRAND_CONDITIONS = ["New", "Made to order", "Limited run"] as const;

export const VERTICALS = [
  "Womenswear",
  "Menswear",
  "Unisex",
  "Jewelry",
  "Shoes",
  "Bags",
  "Accessories",
  "Atelier",
  "Archive",
  "Street",
] as const;
