import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TodayToolsDrawer } from "../../components/TodayToolsDrawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Today from "./index";
import Mirror from "./find";
import Closet from "./closet";
import You from "./you";
import { useColors, useResolvedAppearance } from "../../lib/theme";
import { useCopy } from "../../lib/useCopy";

const ROUTES = ["/", "/find", "/closet", "/you"] as const;
const ICONS = ["compass-outline", "body-outline", "add-outline", "person-outline"] as const;
const ACTIVE_ICONS = ["compass", "body", "add", "person"] as const;

type TabScreen = { key: string; screen: React.ReactNode };

export default function TabsLayout() {
  const appearance = useResolvedAppearance();
  const colors = useColors();
  const C = useCopy();
  const inactiveIcon = appearance === "dark" ? "#A9A398" : colors.muted;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pagerRef = useRef<PagerView>(null);
  const [pageIndex, setPageIndex] = useState(() => routeIndex(pathname) ?? 1);

  const tabs = useMemo<TabScreen[]>(
    () => [
      { key: "workspace", screen: <TodayToolsDrawer onClose={() => pagerRef.current?.setPage(1)} onOpenSell={() => { pagerRef.current?.setPage(3); router.navigate("/closet"); }} /> },
      { key: "today", screen: <Today onOpenTools={() => pagerRef.current?.setPage(0)} /> },
      { key: "mirror", screen: <Mirror /> },
      { key: "sell", screen: <Closet /> },
      { key: "you", screen: <You /> },
    ],
    [C.today, C.mirror, C.sell, C.you],
  );

  useEffect(() => {
    if (pageIndex === 0) return;
    const next = routeIndex(pathname);
    // Keep the current tab mounted underneath stack screens such as Settings.
    // Resetting unknown routes to Today makes the wrong tab flash during pop.
    if (next === null) return;
    if (next === pageIndex) return;
    setPageIndex(next);
    pagerRef.current?.setPageWithoutAnimation(next);
  }, [pathname, pageIndex]);

  function selectTab(tabIndex: number) {
    const next = tabIndex + 1;
    if (next === pageIndex) return;
    setPageIndex(next);
    pagerRef.current?.setPage(next);
    router.navigate(ROUTES[tabIndex]);
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const next = event.nativeEvent.position;
    if (next === pageIndex) return;
    setPageIndex(next);
    void Haptics.selectionAsync().catch(() => undefined);
    if (next === 0) return;
    const route = ROUTES[next - 1];
    if (route !== pathname) router.navigate(route);
  }

  const activeTab = pageIndex === 0 ? 0 : pageIndex - 1;
  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={pageIndex}
        onPageSelected={onPageSelected}
        overScrollMode="never"
        pageMargin={0}
        scrollEnabled
        offscreenPageLimit={1}
      >
        {tabs.map(({ key, screen }) => (
          <View key={key} style={[styles.page, { backgroundColor: colors.ink }]}>{screen}</View>
        ))}
      </PagerView>
      <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]}>
        <View style={[styles.bar, { backgroundColor: colors.ink }]}>
          {ROUTES.map((_, index) => {
            const active = activeTab === index;
            return (
              <Pressable
                key={index}
                onPress={() => selectTab(index)}
                style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                accessibilityRole="tab"
                accessibilityLabel={[C.today, C.mirror, C.sell, C.you][index]}
                accessibilityState={{ selected: active }}
              >
                {index === 2 ? (
                  <View style={styles.sellPlus} accessibilityElementsHidden>
                    <View style={[styles.sellPlusBar, styles.sellPlusHorizontal, { backgroundColor: active ? colors.success : inactiveIcon }]} />
                    <View style={[styles.sellPlusBar, styles.sellPlusVertical, { backgroundColor: active ? colors.success : inactiveIcon }]} />
                  </View>
                ) : (
                  <Ionicons name={active ? ACTIVE_ICONS[index] : ICONS[index]} size={23} color={active ? colors.success : inactiveIcon} />
                )}
                <Text style={[styles.label, { color: active ? colors.success : inactiveIcon }]}>{[C.today, C.mirror, C.sell, C.you][index]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function routeIndex(pathname: string): number | null {
  if (pathname === "/" || pathname.endsWith("/(tabs)") || pathname.endsWith("/(tabs)/")) return 1;
  if (pathname.includes("/find")) return 2;
  if (pathname.includes("/closet")) return 3;
  if (pathname.includes("/you")) return 4;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 4, backgroundColor: "#000000" },
  bar: { minHeight: 60, borderRadius: 0, borderWidth: 0, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 2 },
  tabPressed: { opacity: 0.76 },
  sellPlus: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  sellPlusBar: { position: "absolute", borderRadius: 2 },
  sellPlusHorizontal: { width: 25, height: 3 },
  sellPlusVertical: { width: 3, height: 25 },
  label: { color: "#A9A398", fontSize: 11, fontWeight: "700" },
});
