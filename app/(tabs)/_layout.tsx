import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../../lib/haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageScrollEvent, type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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
const TAB_BAR_HORIZONTAL_PADDING = 10;
const TAB_TOOLTIP_WIDTH = Math.min(210, SCREEN_W - 24);
const TAB_TOOLTIPS = [
  { title: "Today", body: "Discover fresh listings and shop what's new." },
  { title: "Create", body: "Turn your ideas into a brand. Add your logo, list products, and grow your shop." },
  { title: "You", body: "Manage your profile, wardrobe, and settings." },
] as const;

type TabScreen = { key: string; screen: React.ReactNode };

export default function TabsLayout() {
  const appearance = useResolvedAppearance();
  const colors = useColors();
  const C = useCopy();
  const inactiveIcon = appearance === "dark" ? "#A9A398" : colors.muted;
  const todayActiveColor = colors.link ?? colors.pulse;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pagerRef = useRef<PagerView>(null);
  const [pageIndex, setPageIndex] = useState(() => routeIndex(pathname) ?? 0);
  const [open, setOpen] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const longPressRef = useRef(false);
  const tabProgress = useSharedValue(pageIndex);
  const tabWidth = (SCREEN_W - TAB_BAR_HORIZONTAL_PADDING * 2) / ROUTES.length;
  const dashStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tabProgress.value * tabWidth }] }));

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
    tabProgress.value = next;
    pagerRef.current?.setPageWithoutAnimation(next);
  }, [pageIndex, pathname, tabProgress]);

  useEffect(() => {
    if (tooltipIndex === null) return;
    const timeout = setTimeout(() => {
      longPressRef.current = false;
      setTooltipIndex(null);
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [tooltipIndex]);

  function selectTab(tabIndex: number) {
    if (open) setOpen(false);
    if (tabIndex === pageIndex) return;
    setPageIndex(tabIndex);
    tabProgress.value = withTiming(tabIndex, { duration: 240 });
    pagerRef.current?.setPage(tabIndex);
    const route = ROUTES[tabIndex];
    if (route) router.navigate(route);
  }

  function handleTabPress(tabIndex: number) {
    if (longPressRef.current) {
      longPressRef.current = false;
      setTooltipIndex(null);
      return;
    }
    setTooltipIndex(null);
    selectTab(tabIndex);
  }

  function handleTabLongPress(tabIndex: number) {
    longPressRef.current = true;
    setTooltipIndex(tabIndex);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const next = event.nativeEvent.position;
    if (next === pageIndex) return;
    setPageIndex(next);
    tabProgress.value = withTiming(next, { duration: 220 });
    void Haptics.selectionAsync().catch(() => undefined);
    const route = ROUTES[next];
    if (route && route !== pathname) router.navigate(route);
  }

  function onPageScroll(event: PagerViewOnPageScrollEvent) {
    tabProgress.value = event.nativeEvent.position + event.nativeEvent.offset;
  }

  function closeDrawer() {
    setOpen(false);
  }

  const onToday = pageIndex === 0;
  const isCreate = pageIndex === 1;
  const createTabBackground = appearance === "dark" ? colors.ink : "#FFFEFC";
  const createTabInactive = appearance === "dark" ? "#A9A398" : "#6F6A69";
  const createTabActive = appearance === "dark" ? "#FFFFFF" : "#111111";
  const tabBackground = isCreate ? createTabBackground : colors.ink;
  const tabInactive = isCreate ? createTabInactive : inactiveIcon;
  const tabActive = isCreate ? createTabActive : colors.success;
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
            onPageScroll={onPageScroll}
            scrollEnabled={!open}
          >
            {tabs.map(({ key, screen }) => (
              <View key={key} style={[styles.page, { backgroundColor: colors.ink }]} collapsable={false}>{screen}</View>
            ))}
          </DrawerAwarePager>
          {tooltipIndex !== null ? (
            <Pressable
              onPress={() => {
                longPressRef.current = false;
                setTooltipIndex(null);
              }}
              style={styles.tooltipDismiss}
              accessibilityLabel="Dismiss tab explanation"
            />
          ) : null}
          <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: tabBackground }]} pointerEvents={open ? "none" : "auto"}>
            <View style={[styles.bar, { backgroundColor: tabBackground }]}>
              <Animated.View pointerEvents="none" style={[styles.activeDash, { left: TAB_BAR_HORIZONTAL_PADDING + (tabWidth - 30) / 2 }, dashStyle, { backgroundColor: tabActive }]} />
              {ROUTES.map((_, index) => {
                const active = pageIndex === index;
                return (
                  <Pressable
                    key={index}
                    onPress={() => handleTabPress(index)}
                    onLongPress={() => handleTabLongPress(index)}
                    delayLongPress={450}
                    style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                    accessibilityRole="tab"
                    accessibilityLabel={[C.today, C.create ?? "Create", C.you][index]}
                    accessibilityState={{ selected: active }}
                  >
                    {tooltipIndex === index ? (
                      <View pointerEvents="none" style={[styles.tooltip, tooltipLayout(index)]}>
                        <Text style={styles.tooltipTitle}>{TAB_TOOLTIPS[index].title}</Text>
                        <Text style={styles.tooltipBody}>{TAB_TOOLTIPS[index].body}</Text>
                        <View style={[styles.tooltipCaret, { left: tooltipLayout(index).caretLeft }]} />
                      </View>
                    ) : null}
                    <View style={styles.iconSlot} accessibilityElementsHidden>
                      <Ionicons name={active ? ACTIVE_ICONS[index] : ICONS[index]} size={TAB_ICON_SIZE} color={active ? (index === 0 ? todayActiveColor : tabActive) : tabInactive} />
                    </View>
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
  onPageScroll,
  scrollEnabled,
}: {
  children: ReactNode;
  pagerRef: RefObject<PagerView | null>;
  pageIndex: number;
  onPageSelected: (event: PagerViewOnPageSelectedEvent) => void;
  onPageScroll: (event: PagerViewOnPageScrollEvent) => void;
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
        onPageScroll={onPageScroll}
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

function tooltipLayout(index: number) {
  const tabWidth = (SCREEN_W - TAB_BAR_HORIZONTAL_PADDING * 2) / ROUTES.length;
  const iconCenter = TAB_BAR_HORIZONTAL_PADDING + (index + 0.5) * tabWidth;
  const left = Math.max(12, Math.min(iconCenter - TAB_TOOLTIP_WIDTH / 2, SCREEN_W - 12 - TAB_TOOLTIP_WIDTH));
  return {
    left: left - TAB_BAR_HORIZONTAL_PADDING - index * tabWidth,
    width: TAB_TOOLTIP_WIDTH,
    caretLeft: iconCenter - left - 6,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, overflow: "hidden" },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  cardHit: { ...StyleSheet.absoluteFill, zIndex: 5 },
  tooltipDismiss: { ...StyleSheet.absoluteFill, zIndex: 2 },
  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 4, backgroundColor: "#000000", zIndex: 3 },
  bar: { minHeight: 60, borderRadius: 0, borderWidth: 0, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, position: "relative" },
  tab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
  tabPressed: { opacity: 0.76 },
  iconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  activeDash: { position: "absolute", bottom: 3, width: 30, height: 3, borderRadius: 2, zIndex: 4 },
  tooltip: {
    position: "absolute",
    bottom: 57,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#F4F0E6",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    zIndex: 20,
  },
  tooltipTitle: { color: "#171510", fontSize: 13, fontWeight: "800", textAlign: "center" },
  tooltipBody: { color: "#514D43", fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: "center" },
  tooltipCaret: {
    position: "absolute",
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: "#F4F0E6",
    transform: [{ rotate: "45deg" }],
  },
});
