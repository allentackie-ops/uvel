import { useUvel } from "./store";

export type Colors = {
  ink: string;
  surface: string;
  bone: string;
  muted: string;
  subtle: string;
  pulse: string;
  pulseInk: string;
};

export const palettes: Record<"light" | "dark", Colors> = {
  light: {
    ink: "#F4F0E6",
    surface: "#FFFFFF",
    bone: "#16140F",
    muted: "#6B6560",
    subtle: "#8E887E",
    pulse: "#2A320E",
    pulseInk: "#FFFFFF",
  },
  dark: {
    ink: "#12110E",
    surface: "#1C1A16",
    bone: "#F4F0E6",
    muted: "#C4BBB1",
    subtle: "#8A8278",
    pulse: "#2A320E",
    pulseInk: "#FFFFFF",
  },
};

export const colors = palettes.light;

export function useColors(): Colors {
  const { appearance } = useUvel();
  return palettes[appearance];
}
