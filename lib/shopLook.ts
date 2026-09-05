export type ShopLookId = "uvel" | "ivory" | "noir" | "atelier" | "runway" | "oxblood" | "gold" | "pulse";

export type ShopLook = {
  id: ShopLookId;
  name: string;
  line: string;
  plus: boolean;
  page: string;
  bone: string;
  muted: string;
  accent: string;
  accentInk: string;
  surface: string;
  photo: "bleed" | "frame" | "runway";
  status: "light" | "dark";
};

export const SHOP_LOOKS: ShopLook[] = [
  {
    id: "uvel",
    name: "Uvel",
    line: "The floor, as it is",
    plus: false,
    page: "#0B0A08",
    bone: "#F4F0E6",
    muted: "rgba(244,240,230,0.5)",
    accent: "#D6E27A",
    accentInk: "#16140F",
    surface: "#161512",
    photo: "bleed",
    status: "light",
  },
  {
    id: "ivory",
    name: "Ivory gallery",
    line: "Cream page, black type",
    plus: true,
    page: "#F4F0E6",
    bone: "#16140F",
    muted: "rgba(22,20,15,0.5)",
    accent: "#16140F",
    accentInk: "#F4F0E6",
    surface: "#E8E4D8",
    photo: "frame",
    status: "dark",
  },
  {
    id: "noir",
    name: "Noir",
    line: "Black. White. Nothing else",
    plus: true,
    page: "#000000",
    bone: "#FFFFFF",
    muted: "rgba(255,255,255,0.5)",
    accent: "#FFFFFF",
    accentInk: "#000000",
    surface: "#111111",
    photo: "bleed",
    status: "light",
  },
  {
    id: "atelier",
    name: "Atelier",
    line: "Warm paper, brass marks",
    plus: true,
    page: "#E7DFD0",
    bone: "#2A2218",
    muted: "rgba(42,34,24,0.55)",
    accent: "#8A6A3B",
    accentInk: "#F4EFE4",
    surface: "#DDD4C3",
    photo: "frame",
    status: "dark",
  },
  {
    id: "oxblood",
    name: "Oxblood",
    line: "Wine room, cream type",
    plus: true,
    page: "#2C1216",
    bone: "#F3E6DC",
    muted: "rgba(243,230,220,0.55)",
    accent: "#E4B7A0",
    accentInk: "#2C1216",
    surface: "#3A1A20",
    photo: "bleed",
    status: "light",
  },
  {
    id: "gold",
    name: "Night gold",
    line: "Charcoal with gold",
    plus: true,
    page: "#12100C",
    bone: "#F4EBD4",
    muted: "rgba(244,235,212,0.5)",
    accent: "#C9A96E",
    accentInk: "#12100C",
    surface: "#1C1914",
    photo: "bleed",
    status: "light",
  },
];

export function shopLookOf(id?: string | null): ShopLook {
  return SHOP_LOOKS.find((l) => l.id === id) ?? SHOP_LOOKS[0];
}
