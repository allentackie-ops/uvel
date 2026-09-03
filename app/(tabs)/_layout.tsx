import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Today from "./index";
import Mirror from "./find";
import Closet from "./closet";
import Shop from "./shop";
import You from "./you";
import { useColors } from "../../lib/theme";
import { useCopy } from "../../lib/useCopy";

const ROUTES = ["/", "/find", "/closet", "/shop", "/you"] as const;
const ICONS = ["compass-outline", "body-outline", "add-outline", "bag-outline", "person-outline"] as const;
const ACTIVE_ICONS = ["compass", "body", "add", "bag", "person"] as const;

type TabScreen = { key: string; label: string; screen: React.ComponentType };

export default function TabsLayout() {
  const colors = useColors();
  const C = useCopy();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pagerRef = useRef<PagerView>(null);
  const [selected, setSelected] = useState(() => routeIndex(pathname) ?? 0);

  const tabs = useMemo<TabScreen[]>(
    () => [
      { key: "today", label: C.today, screen: Today },
      { key: "mirror", label: C.mirror, screen: Mirror },
      { key: "sell", label: C.sell, screen: Closet },
      { key: "shop", label: C.shop, screen: Shop },
      { key: "you", label: C.you, screen: You },
    ],
    [C.today, C.mirror, C.sell, C.shop, C.you],
  );

  useEffect(() => {
    // Keep the current tab mounted behind stack screens such as Settings.
    // Treating every non-tab route as Today causes a visible pager reset while
    // the stack screen is pushed or popped.
    const next = routeIndex(pathname);
    if (next === null || next === selected) return;
    setSelected(next);
    pagerRef.current?.setPageWithoutAnimation(next);
  }, [pathname, selected]);

  function selectTab(index: number) {
    if (index === selected) return;
    setSelected(index);
    pagerRef.current?.setPage(index);
    router.navigate(ROUTES[index]);
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const index = event.nativeEvent.position;
    if (index === selected) return;
    setSelected(index);
    void Haptics.selectionAsync().catch(() => undefined);
    const currentRouteIndex = routeIndex(pathname);
    if (currentRouteIndex !== null && currentRouteIndex !== index) router.navigate(ROUTES[index]);
  }

  return (
    <View style={[styles.root, { backgroundColor: "#000000" }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={selected}
        onPageSelected={onPageSelected}
        overScrollMode="never"
        pageMargin={0}
        scrollEnabled
        offscreenPageLimit={1}
      >
        {tabs.map(({ key, screen: Screen }) => (
          <View key={key} style={styles.page}>
            <Screen />
          </View>
        ))}
      </PagerView>
      <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.bar}>
          {tabs.map((tab, index) => {
            const active = selected === index;
            return (
              <Pressable
                key={tab.key}
                onPress={() => selectTab(index)}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
              >
                {index === 2 ? (
                  <View style={styles.sellPlus} accessibilityElementsHidden>
                    <View style={[styles.sellPlusBar, styles.sellPlusHorizontal, { backgroundColor: active ? "#16140F" : "#A9A398" }]} />
                    <View style={[styles.sellPlusBar, styles.sellPlusVertical, { backgroundColor: active ? "#16140F" : "#A9A398" }]} />
                  </View>
                ) : (
                  <Ionicons name={active ? ACTIVE_ICONS[index] : ICONS[index]} size={23} color={active ? "#16140F" : "#A9A398"} />
                )}
                <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function routeIndex(pathname: string): number | null {
  if (pathname === "/" || pathname.endsWith("/(tabs)") || pathname.endsWith("/(tabs)/")) return 0;
  if (pathname.includes("/find")) return 1;
  if (pathname.includes("/closet")) return 2;
  if (pathname.includes("/shop")) return 3;
  if (pathname.includes("/you")) return 4;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 10, backgroundColor: "#000000" },
  bar: { minHeight: 68, borderRadius: 0, borderWidth: 0, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: 58, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
  tabActive: { backgroundColor: "#D6E27A" },
  tabPressed: { opacity: 0.76 },
  sellPlus: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  sellPlusBar: { position: "absolute", borderRadius: 2 },
  sellPlusHorizontal: { width: 25, height: 3 },
  sellPlusVertical: { width: 3, height: 25 },
  label: { color: "#A9A398", fontSize: 11, fontWeight: "700" },
  labelActive: { color: "#16140F" },
});
