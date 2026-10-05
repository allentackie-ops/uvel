import { useColorScheme } from "react-native";
import { useUvel, type AppearancePreference } from "./store";

export type Colors = {
  ink: string;
  surface: string;
  bone: string;
  muted: string;
  subtle: string;
  pulse: string;
  link?: string;
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

export const palettes: Record<"dark" | "light", Colors> = {
  dark: {
    ink: "#0B0D12",
    surface: "#1B1E24",
    bone: "#F5F6FA",
    muted: "#A7ACB8",
    subtle: "#737B88",
    pulse: "#C6D86A",
    link: "#C6D86A",
    pulseInk: "#11130E",
    success: "#D6E27A",
    successInk: "#11130E",
    warning: "#E3B65B",
    warningInk: "#11130E",
    danger: "#F06A72",
    dangerInk: "#F5F6FA",
    info: "#20242D",
    infoInk: "#F5F6FA",
    neutral: "#252932",
    neutralInk: "#F5F6FA",
  },
  light: {
    ink: "#FFFFFF",
    surface: "#FFFFFF",
    bone: "#111111",
    muted: "#565959",
    subtle: "#8A8A8A",
    pulse: "#D6E27A",
    link: "#CC0C39",
    pulseInk: "#181714",
    success: "#007EB9",
    successInk: "#FFFFFF",
    warning: "#B7791F",
    warningInk: "#FFFFFF",
    danger: "#CC0C39",
    dangerInk: "#FFFFFF",
    info: "#F2F2F2",
    infoInk: "#111111",
    neutral: "#F2F2F2",
    neutralInk: "#111111",
  },
};

export const colors = palettes.dark;

export function resolveAppearance(
  preference: AppearancePreference,
  systemScheme: "dark" | "light" | "unspecified" | null | undefined,
): "dark" | "light" {
  if (preference === "system") return systemScheme === "light" ? "light" : "dark";
  return preference;
}

export function useResolvedAppearance(): "dark" | "light" {
  const { appearance } = useUvel();
  return resolveAppearance(appearance, useColorScheme());
}

export function useColors(): Colors {
  const { appearance } = useUvel();
  return resolveAppearance(appearance, useColorScheme()) === "light" ? palettes.light : palettes.dark;
}
