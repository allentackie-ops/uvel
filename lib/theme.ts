import { useUvel } from "./store";

type BaseColors = {
  ink: string;
  surface: string;
  bone: string;
  muted: string;
  subtle: string;
  pulse: string;
  pulseInk: string;
  success: string;
  successInk: string;
  warning: string;
  warningInk: string;
  danger: string;
  dangerInk: string;
  info: string;
  infoInk: string;
  neutral: string;
  neutralInk: string;
};

type ModeTokens = {
  legacyPage: string;
  legacyText: string;
  legacyInk: string;
  legacySurface: string;
  legacySurfaceAlt: string;
  navBar: string;
  navInactive: string;
  navActiveInk: string;
};

export type Colors = BaseColors & ModeTokens;

export const palettes: Record<"light" | "dark", BaseColors> = {
  light: {
    ink: "#FFFFFF",
    surface: "#F6F6F6",
    bone: "#161616",
    muted: "#6B6B6B",
    subtle: "#8A8A8A",
    pulse: "#161616",
    pulseInk: "#FFFFFF",
    success: "#D6E27A",
    successInk: "#161616",
    warning: "#9A741C",
    warningInk: "#FFFFFF",
    danger: "#B42318",
    dangerInk: "#FFFFFF",
    info: "#F0F0F0",
    infoInk: "#161616",
    neutral: "#E5E5E5",
    neutralInk: "#161616",
  },
  dark: {
    ink: "#12110E",
    surface: "#1C1A16",
    bone: "#F4F0E6",
    muted: "#C4BBB1",
    subtle: "#8A8278",
    pulse: "#2A320E",
    pulseInk: "#FFFFFF",
    success: "#D6E27A",
    successInk: "#16140F",
    warning: "#C5A85E",
    warningInk: "#16140F",
    danger: "#C45C5C",
    dangerInk: "#F4F0E6",
    info: "#2A2924",
    infoInk: "#F4F0E6",
    neutral: "#24221C",
    neutralInk: "#F4F0E6",
  },
};

const modeTokens: Record<"light" | "dark", ModeTokens> = {
  light: {
    legacyPage: "#FFFFFF",
    legacyText: "#161616",
    legacyInk: "#161616",
    legacySurface: "#F6F6F6",
    legacySurfaceAlt: "#F0F0F0",
    navBar: "#FFFFFF",
    navInactive: "#8A8A8A",
    navActiveInk: "#161616",
  },
  dark: {
    legacyPage: "#0B0A08",
    legacyText: "#F4F0E6",
    legacyInk: "#16140F",
    legacySurface: "#161512",
    legacySurfaceAlt: "#1A1915",
    navBar: "#000000",
    navInactive: "#A9A398",
    navActiveInk: "#16140F",
  },
};

export const colors: Colors = { ...palettes.light, ...modeTokens.light };

export function alpha(color: string, opacity: number): string {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, "0");
  return `#${full}${value}`;
}

export function useColors(): Colors {
  const { appearance } = useUvel();
  return { ...palettes[appearance], ...modeTokens[appearance] };
}
