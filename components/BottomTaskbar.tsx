import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../lib/haptics";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useResolvedAppearance } from "../lib/theme";
import { useCopy } from "../lib/useCopy";

const ROUTES = ["/", "/create", "/you"] as const;
const ICONS = ["compass-outline", "pricetag-outline", "person-outline"] as const;
const ACTIVE_ICONS = ["compass", "pricetag", "person"] as const;

export function BottomTaskbar() {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const copy = useCopy();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const inactiveIcon = appearance === "dark" ? "#A9A398" : colors.muted;
  const activeIndex = pathname === "/create" || pathname.startsWith("/create/")
    ? 1
    : pathname === "/you" || pathname.startsWith("/you/")
      ? 2
      : 0;
  const labels = [copy.today, copy.create ?? "Create", copy.you];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]}>
      <View style={[styles.bar, { backgroundColor: colors.ink }]}>
        {ROUTES.map((route, index) => {
          const active = activeIndex === index;
          return (
            <Pressable
              key={route}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                router.navigate(route);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              accessibilityRole="tab"
              accessibilityLabel={labels[index]}
              accessibilityState={{ selected: active }}
            >
              <View style={styles.iconSlot} accessibilityElementsHidden>
                <Ionicons name={active ? ACTIVE_ICONS[index] : ICONS[index]} size={26} color={active ? colors.success : inactiveIcon} />
              </View>
              <Text style={[styles.label, { color: active ? colors.success : inactiveIcon }]}>{labels[index]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", paddingTop: 4, paddingHorizontal: 0, zIndex: 3 },
  bar: { minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
  tabPressed: { opacity: 0.76 },
  iconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "700" },
});
