import { Image } from "expo-image";
import { router } from "expo-router";
import {  StyleSheet, Text, View } from "react-native";
import { AccessiblePressable } from "./AccessiblePressable";
import { getBrand } from "../lib/brands";
import { uvelFeeCents } from "../lib/fees";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { getPiece, isRemoteListedPiece, likeCount, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { VerifiedMark } from "./VerifiedMark";

export function ListingCard({
  piece,
  wide,
  badge,
  framed,
}: {
  piece: ClosetPiece;
  wide?: number;
  badge?: string;
  framed?: boolean;
}) {
  const colors = useColors();
  const styles = make(colors);
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
  const localPriceCents = convertCents(live.listPriceCents, itemCurrency, here);
  const buyerFee = uvelFeeCents(live.listPriceCents, itemCurrency, here);
  const total = localPriceCents + buyerFee;
  const sync = useMarketplaceSyncState();
  const remote = isRemoteListedPiece(live.id);
  const confirmed = sync === "confirmed" && remote;
  return (
    <AccessiblePressable      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: live.id } })}
      style={({ pressed }) => [styles.wrap, wide ? { width: wide, flex: undefined } : null, framed && styles.framed, pressed && styles.focused]}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${live.name}, ${moneyInMarket(live.listPriceCents, itemCurrency, here)}${typeof live.stockQuantity === "number" ? live.stockQuantity === 0 ? ", sold out" : live.stockQuantity <= 10 ? `, ${live.stockQuantity} remaining` : "" : ""}${!confirmed ? ", availability not confirmed" : ""}`}
      accessibilityHint="Double tap to view this listing."
    >
      <View>
        <Image
          source={{ uri: live.photo }}
          style={[styles.img, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]}
          contentFit="cover"
          accessible={false}
        />
        {framed && fresh ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeTxt}>New</Text>
          </View>
        ) : null}
        {live.brandId && typeof live.stockQuantity === "number" && live.stockQuantity > 0 && live.stockQuantity <= 10 ? (
          <View style={[styles.stockBadge, { top: framed && fresh ? 38 : 10 }]}>
            <Text style={styles.stockBadgeTxt}>{live.stockQuantity} remaining</Text>
          </View>
        ) : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
        <AccessiblePressable onPress={() => { if (!isMine) app.likePiece(live.id); }}
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
        <Text style={[styles.price, framed && styles.priceFramed]}>{moneyInMarket(live.listPriceCents, itemCurrency, here)}</Text>
        <Text style={[styles.sizeLine, framed && styles.brandFramed]} numberOfLines={1}>
          {[live.size || live.sizes?.[0] || "One size", live.condition || "Condition not listed"].join(" · ")}
        </Text>
        <Text style={[styles.total, framed && styles.totalFramed]} numberOfLines={1}>
          {moneyInMarket(total, here.currency, here)} {confirmed ? "incl. buyer protection" : "availability pending"}
        </Text>
        {!confirmed && sync !== "loading" ? (
          <View style={styles.syncDot} />
        ) : null}
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
    framedImg: { borderRadius: 0, backgroundColor: colors.surface },
    newBadge: { position: "absolute", top: 10, left: 10, zIndex: 8 },
    newBadgeTxt: { color: colors.bone, fontSize: 13, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    hearts: { position: "absolute", minWidth: 44, minHeight: 44, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 8 },
    heartsIco: { color: colors.bone, fontSize: 16, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    heartsOn: { color: colors.success },
    heartsN: { color: colors.bone, fontSize: 14, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    badge: { position: "absolute", left: 10, bottom: 10, backgroundColor: `${colors.surface}F0`, paddingHorizontal: 12, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    badgeTxt: { color: colors.ink, fontWeight: "700", fontSize: 12 },
    stockBadge: { position: "absolute", left: 10, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", zIndex: 9 },
    stockBadgeTxt: { color: colors.ink, fontSize: 11, fontWeight: "800" },
    syncDot: { position: "absolute", top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.5 },
    framedMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    brandFramed: { marginTop: 0, letterSpacing: 1.3, fontWeight: "700", color: `${colors.bone}6B` },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    nameFramed: { color: colors.bone, marginTop: 4 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4, fontVariant: ["tabular-nums"] },
    priceFramed: { color: colors.bone },
    sizeLine: { color: `${colors.bone}6B`, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
    total: { color: colors.success, fontSize: 12, marginTop: 5, fontWeight: "700", fontVariant: ["tabular-nums"] },
    totalFramed: { color: colors.success },
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
