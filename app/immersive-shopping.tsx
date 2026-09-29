import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { useFirstFind } from "../lib/firstFind";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, shopFloor, type ClosetPiece, useWardrobe } from "../lib/wardrobe";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ImmersiveShopping() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const firstFind = useFirstFind();
  useWardrobe();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<ClosetPiece>>(null);

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
  const close = useCallback(() => router.back(), []);
  const openPiece = useCallback((piece: ClosetPiece) => {
    router.push({ pathname: "/closet/[id]", params: { id: piece.id } });
  }, []);
  const renderItem = useCallback(({ item }: { item: ClosetPiece }) => (
    <ImmersiveItem
      piece={item}
      active={pieces[activeIndex]?.id === item.id}
      colors={colors}
      styles={styles}
      insets={insets}
      app={app}
      firstFind={firstFind}
      onOpen={openPiece}
    />
  ), [activeIndex, app, colors, firstFind, insets, openPiece, pieces, styles]);

  if (!pieces.length) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 24 }]}>
        <AccessiblePressable onPress={close} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Close Immersive Shopping">
          <Ionicons name="chevron-back" size={28} color={colors.bone} />
        </AccessiblePressable>
        <Text style={styles.emptyKicker}>IMMERSIVE SHOPPING</Text>
        <Text style={styles.emptyTitle}>The edit is quiet for now.</Text>
        <Text style={styles.emptyBody}>Come back soon for more pieces to discover.</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        ref={listRef}
        data={pieces}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        windowSize={3}
        initialNumToRender={2}
      />
      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <AccessiblePressable onPress={close} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Leave Immersive Shopping">
          <Ionicons name="chevron-back" size={28} color={colors.bone} />
        </AccessiblePressable>
        <View style={styles.modeLabel} pointerEvents="none">
          <View style={styles.modeBars}><View style={styles.modeBarShort} /><View style={styles.modeBarTall} /><View style={styles.modeBarMedium} /><View style={styles.modeBarTall} /></View>
          <Text style={styles.modeText}>IMMERSIVE SHOPPING</Text>
        </View>
      </View>
      <View pointerEvents="box-none" style={styles.rightRail}>
        <Text style={styles.scrollHint}>KEEP SCROLLING</Text>
      </View>
      <View style={[styles.nextControl, { bottom: Math.max(insets.bottom, 14) }]}>
        <AccessiblePressable onPress={() => { const next = Math.min(activeIndex + 1, pieces.length - 1); setActiveIndex(next); listRef.current?.scrollToIndex({ index: next, animated: true }); }} style={styles.playerAction} accessibilityRole="button" accessibilityLabel="Next immersive listing">
          <Ionicons name="play-skip-forward" size={20} color={colors.bone} />
        </AccessiblePressable>
      </View>
    </View>
  );
}

function ImmersiveItem({ piece, active, colors, styles, insets, app, firstFind, onOpen }: any) {
  const market = getMarket(app.country);
  const itemCurrency = piece.currency || getMarket(piece.country || app.country).currency;
  const localPrice = moneyInMarket(piece.listPriceCents, itemCurrency, market);
  const credit = firstFind.applyTo(piece, piece.listPriceCents);
  const sale = Math.max(0, piece.listPriceCents - credit);
  const liked = app.saved.includes(piece.id);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : piece.category;

  const share = useCallback(async () => {
    try {
      await Share.share({ message: `Have a look at ${piece.name} on Uvel.`, title: piece.name });
    } catch {
      // The share sheet can be dismissed without action.
    }
  }, [piece.name]);

  return (
    <View style={[styles.item, { height: SCREEN_HEIGHT }]}>
      <AccessiblePressable onPress={() => onOpen(piece)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={`${brand}, ${piece.name}, ${localPrice}. Open listing`}>
        <Image source={{ uri: piece.photo }} style={styles.itemImage} contentFit="cover" accessible={false} />
        <View pointerEvents="none" style={styles.itemShade} />
      </AccessiblePressable>
      <View pointerEvents="box-none" style={[styles.itemCopy, { paddingTop: insets.top + 92, paddingBottom: insets.bottom + 48 }]}>
        <View style={styles.copySpacer} />
        <View>
          {firstFind.matches(piece) ? <Text style={styles.firstFind}>FIRST FIND</Text> : null}
          <Text style={styles.brand}>{brand.toUpperCase()}</Text>
          <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
          {credit > 0 ? (
            <View style={styles.priceRow}><Text style={styles.was}>{localPrice}</Text><Text style={styles.price}>{moneyInMarket(sale, market.currency, market)}</Text></View>
          ) : <Text style={styles.price}>{localPrice}</Text>}
        </View>
      </View>
      <View style={[styles.actions, { bottom: insets.bottom + 148 }]}>
        <Action icon={liked ? "heart" : "heart-outline"} label="Save" active={liked} onPress={() => { if (!liked) app.likePiece(piece.id); else void app.toggleSaved(piece.id); }} styles={styles} colors={colors} />
        <Action icon="share-outline" label="Share" onPress={() => void share()} styles={styles} colors={colors} />
      </View>
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
    itemCopy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 24, justifyContent: "space-between" },
    copySpacer: { flex: 1 },
    topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 10 },
    topIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    modeLabel: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
    modeBars: { height: 22, flexDirection: "row", alignItems: "center", gap: 3 },
    modeBarShort: { width: 3, height: 10, backgroundColor: colors.success, borderRadius: 2 },
    modeBarMedium: { width: 3, height: 16, backgroundColor: colors.success, borderRadius: 2 },
    modeBarTall: { width: 3, height: 22, backgroundColor: colors.success, borderRadius: 2 },
    modeText: { color: colors.bone, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
    rightRail: { position: "absolute", right: 18, bottom: 0, top: 0, justifyContent: "center", zIndex: 5 },
    scrollHint: { color: `${colors.bone}C7`, fontSize: 9, fontWeight: "800", letterSpacing: 1.5, transform: [{ rotate: "90deg" }] },
    firstFind: { alignSelf: "flex-start", color: colors.successInk, backgroundColor: colors.success, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7, fontSize: 11, fontWeight: "900", letterSpacing: 0.2, marginBottom: 10 },
    brand: { color: `${colors.bone}B8`, fontSize: 11, fontWeight: "800", letterSpacing: 2.2, marginBottom: 5, textShadowColor: "#000", textShadowRadius: 6 },
    name: { color: colors.bone, fontSize: 31, lineHeight: 36, fontWeight: "800", maxWidth: "88%", textShadowColor: "#000", textShadowRadius: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 7 },
    price: { color: colors.success, fontSize: 19, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 6 },
    was: { color: `${colors.bone}D0`, fontSize: 16, fontWeight: "700", textDecorationLine: "line-through", textShadowColor: "#000", textShadowRadius: 6 },
    actions: { position: "absolute", right: 15, gap: 18, alignItems: "center", zIndex: 9 },
    action: { width: 54, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
    actionLabel: { color: colors.bone, fontSize: 10, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 },
    nextControl: { position: "absolute", right: 15, zIndex: 12 },
    playerAction: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    empty: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
    backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    emptyKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginTop: 80 },
    emptyTitle: { color: colors.bone, fontSize: 30, fontWeight: "800", marginTop: 12 },
    emptyBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
  });
}
