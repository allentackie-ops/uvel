import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { useState } from "react";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

/**
 * Pressable with an explicit focus ring for keyboard and accessibility focus.
 * The ring is intentionally Uvel lime and is shown only when the user enables Accessibility features.
 */
export function AccessiblePressable({ style, onFocus, onBlur, ...props }: PressableProps) {
  const [focused, setFocused] = useState(false);
  const { accessibilityMode } = useUvel();
  const colors = useColors();
  const styles = make(colors);

  return (
    <Pressable
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={(state) => [typeof style === "function" ? style(state) : style, focused && accessibilityMode ? styles.focusedEnhanced : null]}
    />
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  focused: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  focusedEnhanced: {
    borderWidth: 3,
    borderColor: colors.success,
  },
  });
}
