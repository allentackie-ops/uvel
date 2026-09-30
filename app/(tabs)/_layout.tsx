import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../../lib/haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { Drawer, DrawerGestureContext, useDrawerProgress } from "react-native-drawer-layout";
import { TodayToolsDrawer } from "../../components/TodayToolsDrawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Today from "./index";
import Create from "./create";
import You from "./you";
import Settings from "../settings";
import { useColors, useResolvedAppearance } from "../../lib/theme";
import { useCopy } from "../../lib/useCopy";

const ROUTES = ["/", "/create", "/you"] as const;
const SETTINGS_INDEX = 3;
const ICONS = ["compass-outline", "pricetag-outline", "person-outline"] as const;
const ACTIVE_ICONS = ["compass", "pricetag", "person"] as const;
const TAB_ICON_SIZE = 26;
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
  const [listingOpen, setListingOpen] = useState(false);

  function openSettings() {
    if (open) setOpen(false);
    setPageIndex(SETTINGS_INDEX);
    pagerRef.current?.setPage(SETTINGS_INDEX);
  }

  function closeSettings() {
    setPageIndex(2);
    pagerRef.current?.setPage(2);
  }

  const tabs = useMemo<TabScreen[]>(
    () => [
      { key: "today", screen: <Today onOpenTools={() => setOpen(true)} drawerOpen={open} onListingOpenChange={setListingOpen} /> },
      { key: "create", screen: <Create /> },
      { key: "you", screen: <You onOpenSettings={openSettings} /> },
      { key: "settings", screen: <Settings onBack={closeSettings} /> },
    ],
    [C.today, C.create, C.you, open],
  );

  useEffect(() => {
    const next = routeIndex(pathname);
    if (next === null) return;
    // Settings is an adjacent pager page while the URL remains /you. Do not
    // snap it back to You on the next render while the page is open.
    if (pageIndex === SETTINGS_INDEX && next === 2 && pathname === "/you") return;
    if (next === pageIndex) return;
    setPageIndex(next);
    pagerRef.current?.setPageWithoutAnimation(next);
  }, [pathname, pageIndex]);

  function selectTab(tabIndex: number) {
    if (open) setOpen(false);
    if (tabIndex === pageIndex) return;
    setPageIndex(tabIndex);
    pagerRef.current?.setPage(tabIndex);
    const route = ROUTES[tabIndex];
    if (route) router.navigate(route);
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const next = event.nativeEvent.position;
    if (next === pageIndex) return;
    setPageIndex(next);
    void Haptics.selectionAsync().catch(() => undefined);
    const route = ROUTES[next];
    if (route && route !== pathname) router.navigate(route);
  }

  function closeDrawer() {
    setOpen(false);
  }

  const onToday = pageIndex === 0;
  const swipeEnabled = !listingOpen && (onToday || open);

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <Drawer
        open={open}
        onOpen={() => {
          setOpen(true);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }}
        onClose={closeDrawer}
        swipeEnabled
        swipeEdgeWidth={SCREEN_W}
        swipeMinDistance={10}
        swipeMinVelocity={100}
        drawerType="slide"
        drawerPosition="left"
        drawerStyle={{ width: DRAWER_W, backgroundColor: colors.ink }}
        overlayStyle={{ backgroundColor: "rgba(0,0,0,0.32)" }}
        configureGestureHandler={(handler) => {
          if (!swipeEnabled) {
            return handler.failOffsetX([0, 0]).failOffsetY([0, 0]);
          }
          if (open) {
            return handler.activeOffsetX([-1, 1]);
          }
          return handler.failOffsetX(-1).activeOffsetX(5);
        }}
        renderDrawerContent={() => (
          <TodayToolsDrawer
            onClose={closeDrawer}
            onOpenSell={() => {
              closeDrawer();
              router.push("/sell");
            }}
            onOpenMirror={() => {
              closeDrawer();
              router.push("/mirror");
            }}
          />
        )}
      >
        <ScaledStage>
          <DrawerAwarePager
            pagerRef={pagerRef}
            pageIndex={pageIndex}
            onPageSelected={onPageSelected}
            scrollEnabled={!open}
          >
            {tabs.map(({ key, screen }) => (
              <View key={key} style={[styles.page, { backgroundColor: colors.ink }]} collapsable={false}>{screen}</View>
            ))}
          </DrawerAwarePager>
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
                    accessibilityLabel={[C.today, C.create ?? "Create", C.you][index]}
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.iconSlot} accessibilityElementsHidden>
                      <Ionicons name={active ? ACTIVE_ICONS[index] : ICONS[index]} size={TAB_ICON_SIZE} color={active ? colors.success : inactiveIcon} />
                    </View>
                    <Text style={[styles.label, { color: active ? colors.success : inactiveIcon }]}>{[C.today, C.create ?? "Create", C.you][index]}</Text>
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

function DrawerAwarePager({
  children,
  pagerRef,
  pageIndex,
  onPageSelected,
  scrollEnabled,
}: {
  children: ReactNode;
  pagerRef: RefObject<PagerView | null>;
  pageIndex: number;
  onPageSelected: (event: PagerViewOnPageSelectedEvent) => void;
  scrollEnabled: boolean;
}) {
  const drawerGesture = useContext(DrawerGestureContext);
  const native = useMemo(() => {
    const gesture = Gesture.Native();
    if (drawerGesture) gesture.requireExternalGestureToFail(drawerGesture);
    return gesture;
  }, [drawerGesture]);

  return (
    <GestureDetector gesture={native}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={pageIndex}
        onPageSelected={onPageSelected}
        overScrollMode="never"
        pageMargin={0}
        scrollEnabled={scrollEnabled}
        offscreenPageLimit={1}
      >
        {children}
      </PagerView>
    </GestureDetector>
  );
}

function routeIndex(pathname: string): number | null {
  if (pathname === "/" || pathname.endsWith("/(tabs)") || pathname.endsWith("/(tabs)/")) return 0;
  if (pathname === "/create" || pathname.endsWith("/(tabs)/create") || pathname === "/closet" || pathname.endsWith("/(tabs)/closet")) return 1;
  if (pathname.includes("/you")) return 2;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, overflow: "hidden" },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  cardHit: { ...StyleSheet.absoluteFill, zIndex: 5 },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 4, backgroundColor: "#000000", zIndex: 3 },
  bar: { minHeight: 60, borderRadius: 0, borderWidth: 0, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
  tabPressed: { opacity: 0.76 },
  iconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  label: { color: "#A9A398", fontSize: 11, fontWeight: "700" },
});
