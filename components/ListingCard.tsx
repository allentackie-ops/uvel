import { Image } from "expo-image";
import { router } from "expo-router";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { AccessiblePressable } from "./AccessiblePressable";
import { MotionClip } from "./MotionClip";
import { getBrand, themeFor } from "../lib/brands";
import { useFirstFind } from "../lib/firstFind";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance } from "../lib/theme";
import { shopLookOf } from "../lib/shopLook";
import { getPiece, isRemoteListedPiece, likeCount, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { BrandVerifiedMark } from "./VerifiedMark";
import type { PersonalizationAction } from "../lib/personalization";

const IMAGE_OVERLAY_TEXT = "#F4F0E6";

export function ListingCardSkeleton({ wide, framed }: { wide?: number; framed?: boolean }) {
  const colors = useColors();
  const styles = make(colors);
  const pulse = useRef(new Animated.Value(0.62)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.92, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.62, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.wrap, wide ? { width: wide, flex: undefined } : null, framed && styles.framed, { opacity: pulse }]} pointerEvents="none">
      <View style={[styles.skeletonImg, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]} />
      <View style={framed ? styles.framedMeta : undefined}>
        <View style={[styles.skeletonLine, styles.skeletonBrand]} />
        <View style={[styles.skeletonLine, styles.skeletonName]} />
        <View style={[styles.skeletonLine, styles.skeletonPrice]} />
        <View style={[styles.skeletonLine, styles.skeletonDetail]} />
      </View>
    </Animated.View>
  );
}

export function ListingCard({
  piece,
  wide,
  badge,
  framed,
  firstFind,
  onFirstFind,
  onOpen,
  onInteraction,
}: {
  piece: ClosetPiece;
  wide?: number;
  badge?: string;
  framed?: boolean;
  firstFind?: boolean;
  onFirstFind?: () => void;
  onOpen?: (piece: ClosetPiece, origin: { x: number; y: number; width: number; height: number; radius: number; photo: string; measure?: (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => void }) => void;
  onInteraction?: (action: PersonalizationAction, piece: ClosetPiece) => void;
}) {
  const colors = useColors();
  const likeColor = useResolvedAppearance() === "light" ? colors.danger : colors.success;
  const styles = make(colors);
  const mediaRef = useRef<View>(null);
  const measureMedia = (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => {
    mediaRef.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
  };
  useWardrobe();
  const app = useUvel();
  const live = getPiece(piece.id) || piece;
  const here = getMarket(app.country);
  const fresh = Date.now() - (live.createdAt || 0) < 1000 * 60 * 60 * 24 * 7;
  const isMine = Boolean(app.uid) && live.ownerId === app.uid;
  const hearts = likeCount(live, isMine ? [] : app.saved, app.uid);
  const liked = !isMine && ((live.likedBy || []).some((l) => l.uid === app.uid) || app.saved.includes(live.id));
  const house = live.brandId ? getBrand(live.brandId) : undefined;
  const brand = house?.name || (live.brand && live.brand !== "Unlabeled" ? live.brand : "Unbranded");
  const itemCurrency = live.currency || getMarket(live.country || app.country).currency;
  const shopLook = shopLookOf(live.shopLook, house ? themeFor(house) : null);
  const hasCustomLook = Boolean(live.shopLook || house);
  const find = useFirstFind();
  const localPriceCents = convertCents(live.listPriceCents, itemCurrency, here);
  const credit = firstFind ? find.applyTo(live, localPriceCents) : 0;
  const saleCents = Math.max(0, localPriceCents - credit);
  const sync = useMarketplaceSyncState();
  const remote = isRemoteListedPiece(live.id);
  const confirmed = sync === "confirmed" && remote;
  return (
    <AccessiblePressable      onPress={() => {
      onInteraction?.("view", live);
      if (!onOpen) {
        router.push({ pathname: "/closet/[id]", params: { id: live.id } });
        return;
      }
      measureMedia((rect) => onOpen(live, { ...rect, radius: framed ? 0 : 18, photo: live.photo, measure: measureMedia }));
    }}
      style={({ pressed }) => [styles.wrap, hasCustomLook && { backgroundColor: shopLook.surface, borderColor: shopLook.page, borderWidth: 1 }, wide ? { width: wide, flex: undefined } : null, framed && styles.framed, pressed && app.accessibilityMode && styles.focused]}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${live.name}, ${credit > 0 ? `${moneyInMarket(saleCents, here.currency, here)} with First Find, was ${moneyInMarket(localPriceCents, itemCurrency, here)}` : moneyInMarket(live.listPriceCents, itemCurrency, here)}${typeof live.stockQuantity === "number" ? live.stockQuantity === 0 ? ", sold out" : live.stockQuantity <= 10 ? `, ${live.stockQuantity} remaining` : "" : ""}${!confirmed ? ", availability not confirmed" : ""}`}
      accessibilityHint="Double tap to view this listing."
    >
      <View ref={mediaRef} collapsable={false}>
          <Image cachePolicy="memory-disk"
            source={{ uri: live.photo }}
            style={[styles.img, hasCustomLook && { backgroundColor: shopLook.page }, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]}
          contentFit="cover"
          accessible={false}
        />
        {live.clipUri ? (
          <MotionClip
            uri={live.clipUri}
            style={[styles.img, styles.clip, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]}
          />
        ) : null}
        {live.clipUri ? (
          <View style={styles.motionPill} pointerEvents="none">
            <Text style={styles.motionTxt}>In motion</Text>
          </View>
        ) : null}
        {framed && fresh ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeTxt}>New</Text>
          </View>
        ) : null}
        {firstFind ? (
          <AccessiblePressable
            onPress={() => onFirstFind?.()}
            style={[styles.stockBadge, { top: framed && fresh ? 38 : 10 }]}
            accessibilityRole="button"
            accessibilityLabel="What First Find is"
            accessibilityHint="Double tap to hear how First Find works on this piece."
          >
            <Text style={styles.stockBadgeTxt}>First Find</Text>
          </AccessiblePressable>
        ) : live.brandId && typeof live.stockQuantity === "number" && live.stockQuantity > 0 && live.stockQuantity <= 10 ? (
          <View style={[styles.stockBadge, { top: framed && fresh ? 38 : 10 }]}>
            <Text style={styles.stockBadgeTxt}>{live.stockQuantity} remaining</Text>
          </View>
        ) : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
        <AccessiblePressable onPress={() => { if (!isMine) { onInteraction?.("save", live); app.likePiece(live.id); } }}
          disabled={isMine}
          hitSlop={8}
          style={styles.hearts}
          accessibilityRole="button"
          accessibilityLabel={isMine ? `Likes on your listing ${live.name}` : `${liked ? "Unlike" : "Like"} ${brand} ${live.name}`}
          accessibilityHint={isMine ? "Your own listing cannot be liked from your seller view." : liked ? "Double tap to remove this listing from your saved items." : "Double tap to save this listing."}
          accessibilityState={{ selected: liked, disabled: isMine }}
        >
          <Text style={[styles.heartsIco, liked && { color: likeColor }]}>{liked ? "♥" : "♡"}</Text>
          <Text style={styles.heartsN}>{hearts}</Text>
        </AccessiblePressable>
      </View>
      <View style={[framed ? styles.framedMeta : undefined, hasCustomLook && { backgroundColor: shopLook.surface, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={[styles.brand, framed && styles.brandFramed, hasCustomLook && { color: shopLook.muted }, { flexShrink: 1 }]} numberOfLines={1}>
            {brand.toUpperCase()}
          </Text>
          <BrandVerifiedMark brand={house} size={11} />
        </View>
        <Text style={[styles.name, framed && styles.nameFramed, hasCustomLook && { color: shopLook.bone }]} numberOfLines={2}>
          {piece.name}
        </Text>
        {credit > 0 ? (
          <View style={styles.priceRow}>
            <Text style={styles.was}>{moneyInMarket(localPriceCents, here.currency, here)}</Text>
            <Text style={[styles.price, framed && styles.priceFramed, hasCustomLook && { color: shopLook.accent }]}>{moneyInMarket(saleCents, here.currency, here)}</Text>
          </View>
        ) : (
          <Text style={[styles.price, framed && styles.priceFramed, hasCustomLook && { color: shopLook.accent }]}>{moneyInMarket(live.listPriceCents, itemCurrency, here)}</Text>
        )}
        <Text style={[styles.sizeLine, framed && styles.brandFramed, hasCustomLook && { color: shopLook.muted }]} numberOfLines={1}>
          {[live.size || live.sizes?.[0] || "One size", live.condition || "Condition not listed"].join(" · ")}
        </Text>
      </View>
    </AccessiblePressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { flex: 1, borderRadius: 18 },
    focused: { borderWidth: 2, borderColor: colors.success },
    framed: { backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" },
    img: { width: "100%", aspectRatio: 3 / 4, borderRadius: 18, backgroundColor: colors.surface },
    skeletonImg: { width: "100%", aspectRatio: 3 / 4, borderRadius: 18, backgroundColor: `${colors.bone}18` },
    skeletonLine: { borderRadius: 5, backgroundColor: `${colors.bone}18` },
    skeletonBrand: { width: "42%", height: 9, marginTop: 12 },
    skeletonName: { width: "78%", height: 14, marginTop: 8 },
    skeletonPrice: { width: "31%", height: 13, marginTop: 9 },
    skeletonDetail: { width: "62%", height: 9, marginTop: 8, marginBottom: 12 },
    clip: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    framedImg: { borderRadius: 0, backgroundColor: colors.surface },
    motionPill: { position: "absolute", left: 10, bottom: 10, zIndex: 7, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: "rgba(22,20,15,0.72)", alignItems: "center", justifyContent: "center" },
    motionTxt: { color: IMAGE_OVERLAY_TEXT, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
    newBadge: { position: "absolute", top: 10, left: 10, zIndex: 8 },
    newBadgeTxt: { color: IMAGE_OVERLAY_TEXT, fontSize: 13, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    hearts: { position: "absolute", minWidth: 44, minHeight: 44, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 8 },
    heartsIco: { color: IMAGE_OVERLAY_TEXT, fontSize: 16, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    heartsN: { color: IMAGE_OVERLAY_TEXT, fontSize: 14, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    badge: { position: "absolute", left: 10, bottom: 10, backgroundColor: `${colors.surface}F0`, paddingHorizontal: 12, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    badgeTxt: { color: colors.ink, fontWeight: "700", fontSize: 12 },
    stockBadge: { position: "absolute", left: 10, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", zIndex: 12 },
    stockBadgeTxt: { color: colors.ink, fontSize: 11, fontWeight: "800" },
    framedMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    brandFramed: { marginTop: 0, letterSpacing: 1.3, fontWeight: "700", color: `${colors.bone}6B` },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    nameFramed: { color: colors.bone, marginTop: 4 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" },
    price: { color: colors.success, fontSize: 15, fontWeight: "700", marginTop: 4, fontVariant: ["tabular-nums"] },
    priceFramed: { color: colors.success, marginTop: 0 },
    was: { color: `${colors.bone}66`, fontSize: 13, fontWeight: "600", textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
    sizeLine: { color: `${colors.bone}6B`, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  });
}

export function ListingEmpty({ copy }: { copy: string }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{copy}</Text>
    </View>
  );
}
