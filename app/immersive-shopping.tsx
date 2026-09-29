import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Share as NativeShare, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { FriendShareSheet, type FriendSharePayload } from "../components/FriendShareSheet";
import { TodayCartFab } from "../components/TodayCartFab";
import TodayToolsDrawer from "../components/TodayToolsDrawer";
import * as Haptics from "../lib/haptics";
import { addToCart, useCart } from "../lib/cart";
import { getBrand, isFollowing, toggleFollow, useBrands } from "../lib/brands";
import { useFirstFind } from "../lib/firstFind";
import { getMarket, moneyExact, moneyInMarket } from "../lib/markets";
import { hydrateFollowedSellers, isSellerFollowed, syncSellerFollow, toggleSellerFollow } from "../lib/sellers";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { useCopy } from "../lib/useCopy";
import { getPiece, shopFloor, type ClosetPiece, useWardrobe } from "../lib/wardrobe";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const CATALOG_BRAND_IDS: Record<string, string> = {
  "Maison Found": "maison-found",
  "Archive 1982": "archive-1982",
  "Atelier No. 4": "atelier-no4",
};

export default function ImmersiveShopping() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const firstFind = useFirstFind();
  const C = useCopy();
  const taskbarHeight = 64 + Math.max(insets.bottom, 8);
  const contentHeight = Math.max(1, SCREEN_HEIGHT - taskbarHeight);
  useBrands();
  useEffect(() => { void hydrateFollowedSellers(); }, []);
  useWardrobe();
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [findHint, setFindHint] = useState(false);
  const listRef = useRef<FlatList<ClosetPiece>>(null);
  const menuPressRef = useRef(false);
  useEffect(() => {
    if (!findHint) return;
    const timer = setTimeout(() => setFindHint(false), 3200);
    return () => clearTimeout(timer);
  }, [findHint]);

  const pieces = useMemo(() => {
    const floor = shopFloor(app.country);
    const saved = new Set(app.saved);
    return [...floor].sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id)));
  }, [app.country, app.saved]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const index = viewableItems[0]?.index;
    if (typeof index === "number") setActiveIndex(index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const renderItem = useCallback(({ item }: { item: ClosetPiece }) => (
    <ImmersiveItem
      piece={item}
      active={pieces[activeIndex]?.id === item.id}
      colors={colors}
      styles={styles}
      insets={insets}
      app={app}
      firstFind={firstFind}
      contentHeight={contentHeight}
      onFirstFind={() => setFindHint(true)}
      firstFindLabel={C.firstFind}
    />
  ), [C.firstFind, activeIndex, app, colors, contentHeight, firstFind, insets, pieces, styles]);

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => {
        setDrawerOpen(true);
        if (menuPressRef.current) menuPressRef.current = false;
        else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }}
      onClose={() => setDrawerOpen(false)}
      swipeEnabled
      swipeEdgeWidth={SCREEN_WIDTH}
      swipeMinDistance={10}
      swipeMinVelocity={100}
      drawerType="slide"
      drawerPosition="left"
      drawerStyle={{ width: Math.min(SCREEN_WIDTH * 0.78, 340), backgroundColor: colors.ink }}
      overlayStyle={{ backgroundColor: "rgba(0,0,0,0.32)" }}
      configureGestureHandler={(handler) => drawerOpen ? handler.activeOffsetX([-1, 1]) : handler.failOffsetX(-1).activeOffsetX(5)}
      renderDrawerContent={() => (
        <TodayToolsDrawer
          onClose={() => setDrawerOpen(false)}
          onOpenSell={() => { setDrawerOpen(false); router.push("/sell"); }}
          onOpenMirror={() => { setDrawerOpen(false); router.push("/mirror"); }}
        />
      )}
    >
      <View style={styles.page}>
        {pieces.length ? <FlatList
          ref={listRef}
          data={pieces}
          keyExtractor={(item) => item.id}
          style={{ height: contentHeight }}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={contentHeight}
          snapToAlignment="start"
          getItemLayout={(_, index) => ({ length: contentHeight, offset: contentHeight * index, index })}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          windowSize={3}
          initialNumToRender={2}
          scrollEnabled={!drawerOpen}
        /> : <View style={[styles.empty, { height: contentHeight, paddingTop: insets.top + 24 }]}>
          <Text style={styles.emptyKicker}>IMMERSIVE SHOPPING</Text>
          <Text style={styles.emptyTitle}>The edit is quiet for now.</Text>
          <Text style={styles.emptyBody}>Come back soon for more pieces to discover.</Text>
        </View>}
        <View pointerEvents="box-none" style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
          <AccessiblePressable onPress={() => { menuPressRef.current = true; setDrawerOpen(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Open Today drawer">
            <Ionicons name="menu" size={28} color={colors.bone} />
          </AccessiblePressable>
        </View>
        {findHint ? <View pointerEvents="none" style={[styles.findToast, { top: insets.top + 68 }]} accessibilityLiveRegion="polite">
          <Text style={styles.findToastK}>{C.firstFind}</Text>
          <Text style={styles.findToastTxt}>{C.matchingPiece} · {moneyExact(firstFind.remaining, firstFind.currency)}</Text>
        </View> : null}
        <ImmersiveTaskbar colors={colors} C={C} insets={insets} styles={styles} />
        <TodayCartFab listingOpen />
      </View>
    </Drawer>
  );
}

function ImmersiveTaskbar({ colors, C, insets, styles }: { colors: Colors; C: ReturnType<typeof useCopy>; insets: { bottom: number }; styles: ReturnType<typeof make> }) {
  const tabs = [
    { route: "/" as const, icon: "compass" as const, inactive: "compass-outline" as const, label: C.today },
    { route: "/create" as const, icon: "pricetag" as const, inactive: "pricetag-outline" as const, label: C.create || "Create" },
    { route: "/you" as const, icon: "person-outline" as const, inactive: "person-outline" as const, label: C.you || "You" },
  ];
  return (
    <View style={[styles.taskbarWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]}>
      <View style={[styles.taskbar, { backgroundColor: colors.ink }]}>
        {tabs.map((tab, index) => {
          const active = index === 0;
          return (
            <AccessiblePressable
              key={tab.route}
              onPress={() => router.navigate(tab.route)}
              style={({ pressed }) => [styles.taskbarTab, pressed && styles.taskbarTabPressed]}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <View style={styles.taskbarIconSlot} accessibilityElementsHidden>
                <Ionicons name={active ? tab.icon : tab.inactive} size={26} color={active ? colors.success : colors.muted} />
              </View>
              <Text style={[styles.taskbarLabel, { color: active ? colors.success : colors.muted }]}>{tab.label}</Text>
            </AccessiblePressable>
          );
        })}
      </View>
    </View>
  );
}

function ImmersiveItem({ piece, active, colors, styles, insets, app, firstFind, contentHeight, onFirstFind, firstFindLabel }: any) {
  const [shareOpen, setShareOpen] = useState(false);
  const cart = useCart();
  const lastImageTap = useRef(0);
  const imageTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartX = useSharedValue(SCREEN_WIDTH / 2);
  const heartY = useSharedValue(SCREEN_HEIGHT / 2);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const saveTargetX = useSharedValue(SCREEN_WIDTH - 42);
  const saveTargetY = useSharedValue(SCREEN_HEIGHT - insets.bottom - 148 - 99);
  const brandRecord = piece.brandId ? getBrand(piece.brandId) : undefined;
  const catalogBrandId = !brandRecord && piece.brand ? CATALOG_BRAND_IDS[piece.brand] : undefined;
  const followId = brandRecord?.id || piece.ownerId || piece.listedByUid || catalogBrandId || "";
  const isBrand = Boolean(brandRecord);
  const [following, setFollowing] = useState(() => isBrand ? isFollowing(followId, app.uid) : isSellerFollowed(followId));
  useEffect(() => {
    setFollowing(isBrand ? isFollowing(followId, app.uid) : isSellerFollowed(followId));
  }, [app.uid, followId, isBrand]);
  const market = getMarket(app.country);
  const itemCurrency = piece.currency || getMarket(piece.country || app.country).currency;
  const localPrice = moneyInMarket(piece.listPriceCents, itemCurrency, market);
  const credit = firstFind.applyTo(piece, piece.listPriceCents);
  const sale = Math.max(0, piece.listPriceCents - credit);
  const liked = app.saved.includes(piece.id);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : piece.category;
  const sellerName = brandRecord?.name || piece.ownerName || piece.listedByName || (piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller");
  const sellerPhoto = brandRecord?.logoUri || piece.ownerPhoto || null;
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.` };
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [
      { translateX: heartX.value },
      { translateY: heartY.value },
      { translateX: -34 },
      { translateY: -34 },
      { scale: heartScale.value },
    ],
  }));
  function doubleTapSave(x: number, y: number) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!liked) void app.toggleSaved(piece.id);
    heartX.value = withSequence(withTiming(x, { duration: 1 }), withTiming(saveTargetX.value, { duration: 560 }));
    heartY.value = withSequence(withTiming(y, { duration: 1 }), withTiming(saveTargetY.value, { duration: 560 }));
    heartScale.value = withSequence(withSpring(1.12, { damping: 10, stiffness: 260 }), withTiming(0.55, { duration: 520 }));
    heartOpacity.value = withSequence(withTiming(1, { duration: 1 }), withTiming(0, { duration: 520 }));
  }
  function handleImagePress(x: number, y: number) {
    const now = Date.now();
    if (now - lastImageTap.current <= 450) {
      if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
      lastImageTap.current = 0;
      doubleTapSave(x, y);
      return;
    }
    lastImageTap.current = now;
    if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
    imageTapTimer.current = setTimeout(() => {
      lastImageTap.current = 0;
      imageTapTimer.current = null;
    }, 450);
  }
  function follow() {
    if (!followId) return;
    const next = isBrand ? toggleFollow(followId, app.uid || "me") : toggleSellerFollow(followId);
    setFollowing(next);
    if (!isBrand) void syncSellerFollow(app.uid, followId, next);
  }
  function openSeller() {
    if (brandRecord) router.push({ pathname: "/brand/[id]", params: { id: brandRecord.id } });
    else if (followId) router.push({ pathname: "/seller/[id]", params: { id: followId } });
  }

  return (
    <View style={[styles.item, { height: contentHeight }]}>
      <AccessiblePressable onPress={(event) => handleImagePress(event.nativeEvent.locationX, event.nativeEvent.locationY)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={`${brand}, ${piece.name}, ${localPrice}. Double tap to save.`}>
        <Image source={{ uri: piece.photo }} style={styles.itemImage} contentFit="cover" accessible={false} />
        <View pointerEvents="none" style={styles.itemShade} />
      </AccessiblePressable>
      <View pointerEvents="box-none" style={[styles.itemCopy, { paddingTop: insets.top + 24, paddingBottom: 24 }]}>
        <View style={styles.copySpacer} />
        <View>
          <AccessiblePressable onPress={() => router.back()} style={styles.copyBackButton} accessibilityRole="button" accessibilityLabel="Back to Today">
            <Ionicons name="arrow-back" size={23} color={colors.bone} />
          </AccessiblePressable>
          {firstFind.matches(piece) ? <AccessiblePressable onPress={onFirstFind} style={styles.firstFind} accessibilityRole="button" accessibilityLabel="What First Find is" accessibilityHint="Double tap to hear how First Find works on this piece.">
            <Text style={styles.firstFindText}>{firstFindLabel}</Text>
          </AccessiblePressable> : null}
          <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
          {credit > 0 ? (
            <View style={styles.priceRow}><Text style={styles.was}>{localPrice}</Text><Text style={styles.price}>{moneyInMarket(sale, market.currency, market)}</Text></View>
          ) : <Text style={styles.price}>{localPrice}</Text>}
        </View>
      </View>
      <View style={[styles.actions, { bottom: 118 }]} onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        saveTargetX.value = x + width / 2;
        saveTargetY.value = y + height - 99;
      }}>
        {followId ? <View style={styles.profileRail}>
          <AccessiblePressable onPress={openSeller} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={`View ${sellerName} profile`}>
            {sellerPhoto ? <Image source={{ uri: sellerPhoto }} style={styles.profileAvatar} contentFit="cover" /> : <View style={styles.profileFallback}><Text style={styles.sellerInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}
          </AccessiblePressable>
          <AccessiblePressable onPress={follow} style={[styles.followButton, following && styles.followingButton]} accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${sellerName}` : `Follow ${sellerName}`} accessibilityState={{ selected: following }}>
            <Ionicons name={following ? "checkmark" : "add"} size={15} color={following ? colors.bone : colors.successInk} />
            <Text style={[styles.followText, following && styles.followingText]}>{following ? "Following" : "Follow"}</Text>
          </AccessiblePressable>
        </View> : null}
        <Action
          icon={cart.has(piece.id) ? "checkmark" : "bag-handle-outline"}
          label={cart.has(piece.id) ? "In bag" : "Bag"}
          active={cart.has(piece.id)}
          onPress={() => {
            if (cart.has(piece.id)) return;
            addToCart(piece.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          }}
          styles={styles}
          colors={colors}
        />
        <Action
          icon="body-outline"
          label="Try it on"
          onPress={() => router.push({ pathname: "/try-on", params: { piece: piece.id } })}
          styles={styles}
          colors={colors}
        />
        <Action icon={liked ? "heart" : "heart-outline"} label="Save" active={liked} onPress={() => { if (!liked) app.likePiece(piece.id); else void app.toggleSaved(piece.id); }} styles={styles} colors={colors} />
        <Action icon="share-outline" label="Share" onPress={() => setShareOpen(true)} styles={styles} colors={colors} />
      </View>
      <Animated.Text pointerEvents="none" style={[styles.heartPop, heartStyle]}>♥</Animated.Text>
      <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void NativeShare.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
    </View>
  );
}

function Action({ icon, label, active, onPress, styles, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void; styles: ReturnType<typeof make>; colors: Colors }) {
  return (
    <AccessiblePressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={`${label} listing`} accessibilityState={{ selected: active }}>
      <Ionicons name={icon} size={24} color={active ? colors.success : colors.bone} />
      <Text style={styles.actionLabel}>{label}</Text>
    </AccessiblePressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    item: { width: SCREEN_WIDTH, backgroundColor: colors.ink },
    itemImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    itemShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.20)" },
    topControls: { position: "absolute", top: 0, left: 0, right: 0, paddingLeft: 14, zIndex: 12 },
    menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    itemCopy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 24, justifyContent: "space-between" },
    copySpacer: { flex: 1 },
    copyBackButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    firstFind: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 10 },
    brand: { color: `${colors.bone}B8`, fontSize: 11, fontWeight: "800", letterSpacing: 2.2, marginBottom: 5, textShadowColor: "#000", textShadowRadius: 6 },
    name: { color: colors.bone, fontSize: 31, lineHeight: 36, fontWeight: "800", maxWidth: "88%", textShadowColor: "#000", textShadowRadius: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 7 },
    price: { color: colors.success, fontSize: 19, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 6 },
    was: { color: `${colors.bone}D0`, fontSize: 16, fontWeight: "700", textDecorationLine: "line-through", textShadowColor: "#000", textShadowRadius: 6 },
    profileRail: { alignItems: "center", gap: 7 },
    profileButton: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.bone, overflow: "hidden" },
    profileAvatar: { width: "100%", height: "100%", backgroundColor: colors.surface },
    profileFallback: { width: "100%", height: "100%", backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    sellerInitial: { color: colors.successInk, fontSize: 14, fontWeight: "900" },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 6 },
    followButton: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", gap: 4 },
    followingButton: { backgroundColor: "rgba(0,0,0,0.38)", borderWidth: 1, borderColor: `${colors.bone}70` },
    followText: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
    followingText: { color: colors.bone },
    actions: { position: "absolute", right: 15, gap: 18, alignItems: "center", zIndex: 9 },
    action: { width: 54, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
    actionLabel: { color: colors.bone, fontSize: 10, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 20, color: colors.success, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    empty: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
    emptyKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginTop: 80 },
    emptyTitle: { color: colors.bone, fontSize: 30, fontWeight: "800", marginTop: 12 },
    emptyBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
    firstFindText: { color: colors.successInk, fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
    findToast: { position: "absolute", left: 20, right: 20, zIndex: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(12,11,9,0.88)", borderWidth: 1, borderColor: `${colors.success}66` },
    findToastK: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
    findToastTxt: { color: colors.bone, fontSize: 13, fontWeight: "700", marginTop: 3 },
    taskbarWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 4, zIndex: 15 },
    taskbar: { minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
    taskbarTab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
    taskbarTabPressed: { opacity: 0.76 },
    taskbarIconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    taskbarLabel: { fontSize: 11, fontWeight: "700" },
  });
}
