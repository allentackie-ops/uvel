import type { ImageSourcePropType } from "react-native";

export type Category =
  | "Outerwear"
  | "Dresses"
  | "Tops"
  | "Trousers"
  | "Knitwear"
  | "Shoes"
  | "Skirts"
  | "Bags"
  | "Accessories";

export type Garment = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  color: string;
  size: string;
  priceCents: number;
  condition: string;
  era: string;
  material: string;
  description: string;
  image: ImageSourcePropType;
  tags: string[];
  country: string;
};

export type Trend = {
  slug: string;
  title: string;
  source: "TikTok" | "Instagram" | "X" | "Snapchat";
  summary: string;
  image: ImageSourcePropType;
  garmentIds: string[];
  shopQuery: string;
};

const img = {
  leatherTrench: require("../assets/catalog/leather-trench.jpg"),
  silkSlip: require("../assets/catalog/silk-slip.jpg"),
  woolBlazer: require("../assets/catalog/wool-blazer.jpg"),
  wideTrousers: require("../assets/catalog/wide-trousers.jpg"),
  vintageDenim: require("../assets/catalog/vintage-denim.jpg"),
  cashmereCrew: require("../assets/catalog/cashmere-crew.jpg"),
  cowboyBoots: require("../assets/catalog/cowboy-boots.jpg"),
  poetBlouse: require("../assets/catalog/poet-blouse.jpg"),
  suedeJacket: require("../assets/catalog/suede-jacket.jpg"),
  satinSkirt: require("../assets/catalog/satin-skirt.jpg"),
  fieldJacket: require("../assets/catalog/field-jacket.jpg"),
  loafer: require("../assets/catalog/loafer.jpg"),
  herringboneCoat: require("../assets/catalog/herringbone-coat.jpg"),
  blackTrouser: require("../assets/catalog/black-trouser.jpg"),
  oxfordShirt: require("../assets/catalog/oxford-shirt.jpg"),
  bourgeois: require("../assets/catalog/trend-bourgeois.jpg"),
  western: require("../assets/catalog/trend-western.jpg"),
  utility: require("../assets/catalog/trend-utility.jpg"),
  romantic: require("../assets/catalog/trend-romantic.jpg"),
};

export const GARMENTS: Garment[] = [
  { id: "leather-trench", name: "Espresso leather trench", brand: "Archive 1982", category: "Outerwear", color: "Espresso", size: "M", priceCents: 24800, condition: "Excellent", era: "1980s Italy", material: "Lamb leather", description: "A belted trench in espresso lamb with a wide lapel and a quietly broken-in shoulder.", image: img.leatherTrench, tags: ["trench", "leather", "vintage"], country: "US" },
  { id: "silk-slip", name: "Ivory bias silk slip", brand: "Atelier No. 4", category: "Dresses", color: "Ivory", size: "S", priceCents: 16400, condition: "Excellent", era: "1990s", material: "Silk charmeuse", description: "A bias-cut slip that moves like water.", image: img.silkSlip, tags: ["slip", "silk"], country: "FR" },
  { id: "wool-blazer", name: "Charcoal oversized blazer", brand: "Mill & Co.", category: "Outerwear", color: "Charcoal", size: "L", priceCents: 18900, condition: "Very good", era: "1990s", material: "Wool twill", description: "Strong shoulder, easy body.", image: img.woolBlazer, tags: ["blazer", "wool"], country: "GB" },
  { id: "wide-trousers", name: "Stone wide-leg trousers", brand: "Private label", category: "Trousers", color: "Stone", size: "M", priceCents: 9800, condition: "Excellent", era: "2000s", material: "Wool blend", description: "Full-leg trousers in warm stone.", image: img.wideTrousers, tags: ["trousers", "wide-leg"], country: "NL" },
  { id: "vintage-denim", name: "Indigo vintage denim", brand: "Unlabeled", category: "Trousers", color: "Indigo", size: "29", priceCents: 11200, condition: "Very good", era: "1980s", material: "Cotton denim", description: "High-rise vintage denim with a worn indigo.", image: img.vintageDenim, tags: ["denim"], country: "US" },
  { id: "cashmere-crew", name: "Camel cashmere crew", brand: "Maison Found", category: "Knitwear", color: "Camel", size: "M", priceCents: 14500, condition: "Excellent", era: "1990s", material: "Cashmere", description: "A fine camel crew that sits close without clinging.", image: img.cashmereCrew, tags: ["cashmere"], country: "GB" },
  { id: "cowboy-boots", name: "Oxblood cowboy boots", brand: "Deadstock", category: "Shoes", color: "Oxblood", size: "8", priceCents: 22000, condition: "Excellent", era: "1970s", material: "Leather", description: "Stacked heel, pointed toe, oxblood leather.", image: img.cowboyBoots, tags: ["boots", "western"], country: "US" },
  { id: "poet-blouse", name: "Cream silk poet blouse", brand: "Atelier No. 4", category: "Tops", color: "Cream", size: "S", priceCents: 8600, condition: "Very good", era: "1980s", material: "Silk", description: "Gathered cuffs, an open neck, cream silk.", image: img.poetBlouse, tags: ["blouse", "silk"], country: "FR" },
  { id: "suede-jacket", name: "Rust suede western jacket", brand: "Archive 1982", category: "Outerwear", color: "Rust", size: "M", priceCents: 19800, condition: "Good", era: "1970s", material: "Suede", description: "A western cut in rust suede.", image: img.suedeJacket, tags: ["suede", "western"], country: "MX" },
  { id: "satin-skirt", name: "Champagne satin midi", brand: "Maison Found", category: "Skirts", color: "Champagne", size: "S", priceCents: 9200, condition: "Excellent", era: "1990s", material: "Acetate satin", description: "Bias midi in champagne satin.", image: img.satinSkirt, tags: ["skirt", "satin"], country: "IT" },
  { id: "field-jacket", name: "Olive field jacket", brand: "Unlabeled", category: "Outerwear", color: "Olive", size: "L", priceCents: 13400, condition: "Very good", era: "1990s", material: "Cotton twill", description: "Utility, not costume.", image: img.fieldJacket, tags: ["utility"], country: "DE" },
  { id: "loafer", name: "Chocolate leather loafers", brand: "Mill & Co.", category: "Shoes", color: "Chocolate", size: "8.5", priceCents: 15600, condition: "Excellent", era: "1990s", material: "Calf leather", description: "Unadorned chocolate loafers.", image: img.loafer, tags: ["loafers"], country: "GB" },
  { id: "herringbone-coat", name: "Herringbone overcoat", brand: "Archive 1982", category: "Outerwear", color: "Grey", size: "M", priceCents: 27500, condition: "Excellent", era: "1980s", material: "Wool herringbone", description: "A heavy grey herringbone coat.", image: img.herringboneCoat, tags: ["coat"], country: "GB" },
  { id: "black-trouser", name: "Black tailored trousers", brand: "Private label", category: "Trousers", color: "Black", size: "M", priceCents: 10800, condition: "Excellent", era: "2000s", material: "Wool", description: "A sharp crease, a clean rise.", image: img.blackTrouser, tags: ["trousers"], country: "IT" },
  { id: "oxford-shirt", name: "Vintage cream oxford", brand: "Deadstock", category: "Tops", color: "Cream", size: "M", priceCents: 6400, condition: "Very good", era: "1990s", material: "Cotton oxford", description: "Slightly oversized cream oxford.", image: img.oxfordShirt, tags: ["oxford"], country: "US" },
];

export const TRENDS: Trend[] = [
  { slug: "bourgeois-chic", title: "Bourgeois chic, not costume", source: "TikTok", summary: "Quiet luxury loosened its collar. Camel knit, stone wide-legs, a bag that looks inherited.", image: img.bourgeois, garmentIds: ["cashmere-crew", "oxford-shirt", "wide-trousers", "loafer"], shopQuery: "camel cashmere" },
  { slug: "western-city", title: "Western, after 6", source: "Instagram", summary: "Suede yokes and oxblood boots on city pavement. One western piece, not a costume.", image: img.western, garmentIds: ["suede-jacket", "vintage-denim", "cowboy-boots"], shopQuery: "suede western" },
  { slug: "utility-real", title: "Utility that actually works", source: "X", summary: "Field jackets over knits. Weather-ready cotton, worn like clothes.", image: img.utility, garmentIds: ["field-jacket", "cashmere-crew", "vintage-denim"], shopQuery: "field jacket" },
  { slug: "liquid-evening", title: "Liquid evening", source: "Snapchat", summary: "Ivory slip, champagne satin. After-dark dressing went fluid again.", image: img.romantic, garmentIds: ["silk-slip", "satin-skirt", "poet-blouse"], shopQuery: "silk slip" },
];

export const CATEGORIES: Array<"All" | Category> = [
  "All",
  "Outerwear",
  "Dresses",
  "Tops",
  "Trousers",
  "Knitwear",
  "Skirts",
  "Shoes",
  "Bags",
  "Accessories",
];

import { money } from "./markets";

export function usd(cents: number, currency = "USD") {
  return money(cents, currency);
}

export function getGarment(id: string) {
  return GARMENTS.find((g) => g.id === id);
}
