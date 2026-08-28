import { useMemo } from "react";
import { t } from "./i18n";
import { useUvel } from "./store";

/**
 * Returns the current app copy and re-renders when the user changes language.
 * Screens should use this rather than reading the locale label alone.
 */
export function useCopy() {
  const { locale } = useUvel();
  return useMemo(() => t(locale || "en-US"), [locale]);
}
