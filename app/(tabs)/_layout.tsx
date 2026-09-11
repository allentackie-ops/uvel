import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { Drawer, useDrawerProgress } from "react-native-drawer-layout";
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
const SCREEN_W = Dimensions.get("window").width;
const DRAWER_W = Math.min(SCREEN_W * 0.78, 340);

type TabScreen = { key: string; screen: React.ReactNode };

export default function TabsLayout() {
  const appearance = useResolvedAppearance();
  const colors = useColors();
  const C = useCopy();
  const inactiveIcon = appearance === "dark" ? "#A9A398" : colors.muted;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pagerRef = useRef<PagerView>(null);
  const [pageIndex, setPageIndex] = useState(() => routeIndex(pathname) ?? 0);
  const [open, setOpen] = useState(false);

  const tabs = useMemo<TabScreen[]>(
    () => [
      { key: "today", screen: <Today onOpenTools={() => setOpen(true)} /> },
      { key: "mirror", screen: <Mirror /> },
      { key: "sell", screen: <Closet /> },
      { key: "you", screen: <You /> },
    ],
    [C.today, C.mirror, C.sell, C.you],
  );

  useEffect(() => {
    const next = routeIndex(pathname);
    if (next === null) return;
    if (next === pageIndex) return;
    setPageIndex(next);
    pagerRef.current?.setPageWithoutAnimation(next);
  }, [pathname, pageIndex]);

  function selectTab(tabIndex: number) {
    if (open) setOpen(false);
    if (tabIndex === pageIndex) return;
    setPageIndex(tabIndex);
    pagerRef.current?.setPage(tabIndex);
    router.navigate(ROUTES[tabIndex]);
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const next = event.nativeEvent.position;
    if (next === pageIndex) return;
    setPageIndex(next);
    void Haptics.selectionAsync().catch(() => undefined);
    const route = ROUTES[next];
    if (route !== pathname) router.navigate(route);
  }

  function closeDrawer() {
    setOpen(false);
  }

  const onToday = pageIndex === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <Drawer
        open={open}
        onOpen={() => setOpen(true)}
        onClose={closeDrawer}
        swipeEnabled={onToday || open}
        swipeEdgeWidth={open ? SCREEN_W : Math.round(SCREEN_W * 0.42)}
        swipeMinDistance={36}
        swipeMinVelocity={320}
        drawerType="slide"
        drawerPosition="left"
        drawerStyle={{ width: DRAWER_W, backgroundColor: colors.ink }}
        overlayStyle={{ backgroundColor: "rgba(0,0,0,0.32)" }}
        renderDrawerContent={() => (
          <TodayToolsDrawer
            onClose={closeDrawer}
            onOpenSell={() => {
              closeDrawer();
              selectTab(2);
            }}
          />
        )}
      >
        <ScaledStage>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={pageIndex}
            onPageSelected={onPageSelected}
            overScrollMode="never"
            pageMargin={0}
            scrollEnabled={!open}
            offscreenPageLimit={1}
          >
            {tabs.map(({ key, screen }) => (
              <View key={key} style={[styles.page, { backgroundColor: colors.ink }]} collapsable={false}>{screen}</View>
            ))}
          </PagerView>
          <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]} pointerEvents={open ? "none" : "auto"}>
            <View style={[styles.bar, { backgroundColor: colors.ink }]}>
              {ROUTES.map((_, index) => {
                const active = pageIndex === index;
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
          {open ? (
            <Pressable
              onPress={closeDrawer}
              style={styles.cardHit}
              accessibilityRole="button"
              accessibilityLabel="Back to Today"
            />
          ) : null}
        </ScaledStage>
      </Drawer>
    </View>
  );
}

function ScaledStage({ children }: { children: ReactNode }) {
  const progress = useDrawerProgress();
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      borderRadius: interpolate(p, [0, 1], [0, 28]),
      transform: [{ scale: interpolate(p, [0, 1], [1, 0.9]) }],
    };
  });
  return <Animated.View style={[styles.stage, style]}>{children}</Animated.View>;
}

function routeIndex(pathname: string): number | null {
  if (pathname === "/" || pathname.endsWith("/(tabs)") || pathname.endsWith("/(tabs)/")) return 0;
  if (pathname.includes("/find")) return 1;
  if (pathname.includes("/closet")) return 2;
  if (pathname.includes("/you")) return 3;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, overflow: "hidden" },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  cardHit: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 4, backgroundColor: "#000000", zIndex: 3 },
  bar: { minHeight: 60, borderRadius: 0, borderWidth: 0, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 2 },
  tabPressed: { opacity: 0.76 },
  sellPlus: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  sellPlusBar: { position: "absolute", borderRadius: 2 },
  sellPlusHorizontal: { width: 25, height: 3 },
  sellPlusVertical: { width: 3, height: 25 },
  label: { color: "#A9A398", fontSize: 11, fontWeight: "700" },
});
