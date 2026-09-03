import { useUvel } from "./store";

export type Colors = {
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

export const palettes: Record<"dark", Colors> = {
  dark: {
    ink: "#000000",
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

export const colors = palettes.dark;

export function useColors(): Colors {
  return palettes.dark;
}
