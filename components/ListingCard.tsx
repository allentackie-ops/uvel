import { Image } from "expo-image";
import { router } from "expo-router";
import {  StyleSheet, Text, View } from "react-native";
import { useRef } from "react";
import { AccessiblePressable } from "./AccessiblePressable";
import { MotionClip } from "./MotionClip";
import { getBrand } from "../lib/brands";
import { useFirstFind } from "../lib/firstFind";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { getPiece, isRemoteListedPiece, likeCount, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { VerifiedMark } from "./VerifiedMark";
import type { PersonalizationAction } from "../lib/personalization";

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
  onOpen?: (piece: ClosetPiece, origin: { x: number; y: number; width: number; height: number }) => void;
  onInteraction?: (action: PersonalizationAction, piece: ClosetPiece) => void;
}) {
  const colors = useColors();
  const styles = make(colors);
  const mediaRef = useRef<View>(null);
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
      mediaRef.current?.measureInWindow((x, y, width, height) => onOpen(live, { x, y, width, height }));
    }}
      style={({ pressed }) => [styles.wrap, wide ? { width: wide, flex: undefined } : null, framed && styles.framed, pressed && app.accessibilityMode && styles.focused]}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${live.name}, ${credit > 0 ? `${moneyInMarket(saleCents, here.currency, here)} with First Find, was ${moneyInMarket(localPriceCents, itemCurrency, here)}` : moneyInMarket(live.listPriceCents, itemCurrency, here)}${typeof live.stockQuantity === "number" ? live.stockQuantity === 0 ? ", sold out" : live.stockQuantity <= 10 ? `, ${live.stockQuantity} remaining` : "" : ""}${!confirmed ? ", availability not confirmed" : ""}`}
      accessibilityHint="Double tap to view this listing."
    >
      <View ref={mediaRef}>
        <Image
          source={{ uri: live.photo }}
          style={[styles.img, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]}
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
          <Text style={[styles.heartsIco, liked && styles.heartsOn]}>{liked ? "♥" : "♡"}</Text>
          <Text style={styles.heartsN}>{hearts}</Text>
        </AccessiblePressable>
      </View>
      <View style={framed ? styles.framedMeta : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={[styles.brand, framed && styles.brandFramed, { flexShrink: 1 }]} numberOfLines={1}>
            {brand.toUpperCase()}
          </Text>
          {house?.verified ? <VerifiedMark size={11} /> : null}
        </View>
        <Text style={[styles.name, framed && styles.nameFramed]} numberOfLines={2}>
          {piece.name}
        </Text>
        {credit > 0 ? (
          <View style={styles.priceRow}>
            <Text style={styles.was}>{moneyInMarket(localPriceCents, here.currency, here)}</Text>
            <Text style={[styles.price, framed && styles.priceFramed]}>{moneyInMarket(saleCents, here.currency, here)}</Text>
          </View>
        ) : (
          <Text style={[styles.price, framed && styles.priceFramed]}>{moneyInMarket(live.listPriceCents, itemCurrency, here)}</Text>
        )}
        <Text style={[styles.sizeLine, framed && styles.brandFramed]} numberOfLines={1}>
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
    clip: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    framedImg: { borderRadius: 0, backgroundColor: colors.surface },
    motionPill: { position: "absolute", left: 10, bottom: 10, zIndex: 7, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: "rgba(22,20,15,0.72)", alignItems: "center", justifyContent: "center" },
    motionTxt: { color: colors.bone, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
    newBadge: { position: "absolute", top: 10, left: 10, zIndex: 8 },
    newBadgeTxt: { color: colors.bone, fontSize: 13, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    hearts: { position: "absolute", minWidth: 44, minHeight: 44, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 8 },
    heartsIco: { color: colors.bone, fontSize: 16, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    heartsOn: { color: colors.success },
    heartsN: { color: colors.bone, fontSize: 14, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
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
