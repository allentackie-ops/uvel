import { useColorScheme } from "react-native";
import { useUvel, type AppearancePreference } from "./store";

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

export const palettes: Record<"dark" | "light", Colors> = {
  dark: {
    ink: "#0B0D12",
    surface: "#1B1E24",
    bone: "#F5F6FA",
    muted: "#A7ACB8",
    subtle: "#737B88",
    pulse: "#C6D86A",
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
    ink: "#F7F6F2",
    surface: "#FFFFFF",
    bone: "#181714",
    muted: "#6F6A62",
    subtle: "#9B958C",
    pulse: "#6F8319",
    pulseInk: "#181714",
    success: "#C9D866",
    successInk: "#181714",
    warning: "#A77D2A",
    warningInk: "#FFFFFF",
    danger: "#C45C5C",
    dangerInk: "#FFFFFF",
    info: "#E9E7E1",
    infoInk: "#181714",
    neutral: "#E3E0D8",
    neutralInk: "#181714",
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
