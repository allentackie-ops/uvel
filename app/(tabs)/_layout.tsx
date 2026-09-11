import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
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
const TRAVEL = SCREEN_W * 0.24;
const SPRING = { damping: 28, stiffness: 260, mass: 0.78 };

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);

  const tabs = useMemo<TabScreen[]>(
    () => [
      { key: "today", screen: <Today onOpenTools={() => openTools()} /> },
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
    if (toolsOpen) closeTools();
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

  function openTools() {
    setToolsOpen(true);
    progress.value = withSpring(1, SPRING);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  function closeTools() {
    setToolsOpen(false);
    progress.value = withSpring(0, SPRING);
  }

  function finishGesture(open: boolean) {
    setToolsOpen(open);
    if (open) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  function goMirror() {
    setPageIndex(1);
    pagerRef.current?.setPage(1);
    router.navigate("/find");
  }

  const pan = Gesture.Pan()
    .enabled(pageIndex === 0 || toolsOpen)
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      touchX.value = touch.absoluteX;
      touchY.value = touch.absoluteY;
      startProgress.value = progress.value;
    })
    .onTouchesMove((event, manager) => {
      if (progress.value > 0.02) {
        manager.activate();
        return;
      }
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - touchX.value;
      const dy = touch.absoluteY - touchY.value;
      if (Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy)) {
        manager.activate();
      } else if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        manager.fail();
      }
    })
    .onUpdate((event) => {
      if (startProgress.value <= 0.02 && event.translationX < 0) return;
      const next = startProgress.value + event.translationX / TRAVEL;
      progress.value = Math.max(0, Math.min(1, next));
    })
    .onEnd((event) => {
      if (startProgress.value <= 0.02 && event.translationX < -48 && progress.value < 0.08) {
        progress.value = withSpring(0, SPRING);
        runOnJS(goMirror)();
        return;
      }
      const shouldOpen = event.velocityX > 180 ? true : event.velocityX < -180 ? false : progress.value > 0.12;
      progress.value = withSpring(shouldOpen ? 1 : 0, SPRING);
      runOnJS(finishGesture)(shouldOpen);
    });

  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = interpolate(p, [0, 1], [1, 0.88]);
    const inset = (SCREEN_W * (1 - 0.88)) / 2;
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [0, DRAWER_W - inset]) },
        { scale },
      ],
      borderRadius: interpolate(p, [0, 1], [0, 28]),
    };
  });

  const dimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.42,
  }));
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-DRAWER_W, 0]) }],
  }));

  const activeTab = pageIndex;
  const onToday = pageIndex === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <Animated.View style={[styles.drawer, { width: DRAWER_W }, drawerStyle]} pointerEvents={toolsOpen ? "auto" : "none"}>
        <TodayToolsDrawer
          onClose={closeTools}
          onOpenSell={() => {
            closeTools();
            selectTab(2);
          }}
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.stage, { backgroundColor: colors.ink }, contentStyle]}>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={pageIndex}
            onPageSelected={onPageSelected}
            overScrollMode="never"
            pageMargin={0}
            scrollEnabled={!toolsOpen && !onToday}
            offscreenPageLimit={1}
            pointerEvents={toolsOpen ? "none" : "auto"}
          >
            {tabs.map(({ key, screen }) => (
              <View key={key} style={[styles.page, { backgroundColor: colors.ink }]} collapsable={false}>{screen}</View>
            ))}
          </PagerView>
          <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]} pointerEvents={toolsOpen ? "none" : "auto"}>
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
          <Animated.View pointerEvents="none" style={[styles.dim, dimStyle]} />
          {toolsOpen ? (
            <Pressable
              onPress={closeTools}
              style={styles.cardHit}
              accessibilityRole="button"
              accessibilityLabel="Back to Today"
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
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
  drawer: { position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 6 },
  stage: { flex: 1, zIndex: 2, overflow: "hidden" },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: "#000000" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 4 },
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
