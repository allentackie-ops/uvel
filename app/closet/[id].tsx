import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usd } from "../../lib/catalog";
import { recordAnalyticsEvent } from "../../lib/analytics";
import { getMarket } from "../../lib/markets";
import { getBrand, useBrands } from "../../lib/brands";
import { listingVisibleIn, shipsToLine } from "../../lib/ships";
import { shopLookOf, type ShopLook } from "../../lib/shopLook";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { VerifiedMark } from "../../components/VerifiedMark";
import { getPiece, isRemoteListedPiece, likeCount, markSold, recordPieceView, unlistPiece, updatePiece, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const HERO_H = Math.round(W * 1.28);

const SWATCH: Record<string, string> = {
  olive: "#6E7C3A",
  green: "#2F6B3A",
  black: "#111111",
  white: "#F4F0E6",
  cream: "#E8DFD0",
  ivory: "#F4F0E6",
  navy: "#1B2A4A",
  blue: "#2C4C8A",
  red: "#9B1C2C",
  burgundy: "#6B1D2A",
  wine: "#5A1824",
  brown: "#5C3A24",
  tan: "#C4A574",
  beige: "#D8C7A8",
  pink: "#D9A3B0",
  gold: "#C9A96E",
  silver: "#C5C0B6",
  grey: "#8A8580",
  gray: "#8A8580",
  yellow: "#D6C25A",
  orange: "#C4652A",
  purple: "#5C3D7A",
  camel: "#C4A574",
  khaki: "#9A8B5C",
  rust: "#A24A2A",
};

function swatchOf(color?: string) {
  if (!color) return null;
  const n = color.toLowerCase();
  const hit = Object.keys(SWATCH).find((k) => n.includes(k));
  return hit ? SWATCH[hit] : null;
}

function isMine(piece: ClosetPiece, uid: string) {
  return Boolean(uid) && Boolean(piece.ownerId) && piece.ownerId === uid;
}

function OwnerListing({ piece, insets }: { piece: ClosetPiece; insets: { top: number; bottom: number } }) {
  const colors = useColors();
  const app = useUvel();
  const styles = useMemo(() => ownerStyles(colors), [colors]);
  const look = shopLookOf(piece.shopLook);
  const gallery = piece.photos?.length ? piece.photos : piece.photo ? [piece.photo] : [];
  const onFloor = piece.status === "listed";
  const sold = piece.status === "sold";
  const status = sold ? "Sold" : onFloor ? "In the shop" : "Not listed";

  useEffect(() => {
    const patch: Partial<ClosetPiece> = {};
    if (app.uid && piece.ownerId !== app.uid) patch.ownerId = app.uid;
    if (app.displayName && piece.ownerName !== app.displayName) patch.ownerName = app.displayName;
    const face = app.avatarUri || app.personUri;
    if (face && piece.ownerPhoto !== face) patch.ownerPhoto = face;
    if (Object.keys(patch).length) updatePiece(piece.id, patch);
  }, [app.uid, app.displayName, app.personUri, app.avatarUri, piece.id, piece.ownerId, piece.ownerName, piece.ownerPhoto]);

  function takeDown() {
    Alert.alert("Take off the floor?", "Buyers won’t see this listing until you list it again.", [
      { text: "Keep it up", style: "cancel" },
      { text: "Take down", onPress: () => unlistPiece(piece.id) },
    ]);
  }

  function soldIt() {
    Alert.alert("Mark as sold?", "It leaves the shop.", [
      { text: "Cancel", style: "cancel" },
      { text: "Mark sold", onPress: () => markSold(piece.id) },
    ]);
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.bone === "#F4F0E6" ? "light" : "dark"} />
      <View style={styles.heroWrap}>
        <Image source={{ uri: gallery[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Pressable onPress={() => router.back()} style={[styles.iconBtn, { top: insets.top + 6 }]} hitSlop={8}>
          <Text style={styles.iconTxt}>‹</Text>
        </Pressable>
        <View style={[styles.badge, { top: insets.top + 14 }]}>
          <Text style={styles.badgeTxt}>{status}</Text>
        </View>
        {piece.brandId && typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10 ? (
          <View style={[styles.stockBadge, { top: insets.top + 58 }]}>
            <Text style={styles.stockBadgeTxt}>{piece.stockQuantity} remaining</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>Your listing</Text>
        <Text style={styles.title}>{piece.name}</Text>
        <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
        <Text style={styles.meta}>{[piece.size, piece.color, piece.condition].filter(Boolean).join("  ·  ")}</Text>
        <Text style={styles.meta}>{shipsToLine(piece.country || app.country, piece.shipsTo)}</Text>
        {piece.shopLook && piece.shopLook !== "uvel" ? <Text style={styles.look}>Shop look · {look.name}</Text> : null}
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })} style={styles.edit}>
          <Text style={styles.editTxt}>Edit listing</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id, v: "buy" } })}
          style={styles.preview}
        >
          <Text style={styles.previewTxt}>Preview as buyer</Text>
        </Pressable>
        {onFloor ? (
          <View style={styles.row}>
            <Pressable onPress={takeDown} style={styles.ghost}>
              <Text style={styles.ghostTxt}>Take down</Text>
            </Pressable>
            <Pressable onPress={soldIt} style={styles.ghost}>
              <Text style={styles.ghostTxt}>Mark sold</Text>
            </Pressable>
          </View>
        ) : null}
        {!sold && piece.status === "owned" ? (
          <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })} style={styles.ghost}>
            <Text style={styles.ghostTxt}>List this piece</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ClosetPiece() {
  const insets = useSafeAreaInsets();
  const { id, v, campaignId, collectionId, promotionId, campaignChannel } = useLocalSearchParams<{ id: string; v?: string; campaignId?: string; collectionId?: string; promotionId?: string; campaignChannel?: string }>();
  useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  useBrands();
  const app = useUvel();
  const preview = v === "buy";
  const [page, setPage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const piece = getPiece(id);
  const look = shopLookOf(piece?.shopLook);

  useEffect(() => {
    const sizes = piece?.sizes?.length ? piece.sizes : piece?.size ? [piece.size] : [];
    setSelectedSize((current) => (current && sizes.includes(current) ? current : sizes[0] || ""));
  }, [piece?.id, piece?.size, piece?.sizes?.join("|")]);

  useEffect(() => {
    if (!piece || !piece.brandId || !app.uid || (isMine(piece, app.uid) && !preview)) return;
    void recordAnalyticsEvent({
      type: "listing_view",
      brandId: piece.brandId,
      listingId: piece.id,
      listingName: piece.name,
      listingPhoto: piece.photo,
    }).catch(() => undefined);
  }, [piece?.id, piece?.brandId, piece?.name, piece?.photo, app.uid, preview]);
  const styles = useMemo(() => make(look), [look]);
  const liked =
    !!piece &&
    Boolean(app.uid) &&
    (app.saved.includes(piece.id) || (piece.likedBy || []).some((l) => l.uid === app.uid));
  const hearts = piece ? likeCount(piece, app.saved, app.uid) : 0;

  useEffect(() => {
    if (!piece) return;
    if (isMine(piece, app.uid) && v !== "buy") return;
    recordPieceView(piece.id);
  }, [piece?.id, app.uid, v]);

  if (!piece) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={styles.p}>That piece isn’t on the floor.</Text>
      </View>
    );
  }

  if (isMine(piece, app.uid) && !preview) {
    return <OwnerListing piece={piece} insets={insets} />;
  }

  const onFloor = piece.status === "listed";
  const remoteListing = isRemoteListedPiece(piece.id);
  const availabilityConfirmed = marketplaceSync === "confirmed" && remoteListing;
  const sizeOptions = piece.sizes?.length ? piece.sizes : piece.size ? [piece.size] : [];
  const selectedStock = selectedSize && piece.sizeStock ? piece.sizeStock[selectedSize] : piece.stockQuantity;
  const inventoryTracked = Boolean(piece.brandId && (typeof piece.stockQuantity === "number" || Boolean(piece.sizeStock)));
  const inStock = !inventoryTracked || (typeof selectedStock === "number" && selectedStock > 0);
  const gallery = piece.photos?.length ? piece.photos : piece.photo ? [piece.photo] : [];
  const pieceId = piece.id;
  const framed = look.photo === "frame";
  const runway = look.photo === "runway";
  const heroH = framed ? Math.round(W * 1.12) : HERO_H;
  const imgW = framed ? W - 28 : W;
  const imgH = framed ? heroH - 28 : heroH;
  const brand = piece.brand !== "Unlabeled" ? piece.brand : "Uvel closet";
  const chip = swatchOf(piece.color);
  const mine = isMine(piece, app.uid);
  const owningBrand = piece.brandId ? getBrand(piece.brandId) : undefined;
  const seller = owningBrand?.name || (mine && app.displayName) || piece.ownerName || "Uvel member";
  const sellerPhoto = owningBrand?.logoUri || ((mine && (app.avatarUri || app.personUri)) || piece.ownerPhoto || null);
  const sellerLabel = owningBrand ? "Sold by brand" : "Sold by";
  const ship = getMarket(piece.country || app.country);
  const onThisFloor = listingVisibleIn({
    origin: piece.country,
    shipsTo: piece.shipsTo,
    buyer: app.country,
  });
  const canBuy = availabilityConfirmed && onFloor && onThisFloor && inStock && (!inventoryTracked || sizeOptions.length === 0 || Boolean(selectedSize));

  function tryOnMe() {
    if (!app.isPlus && app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    router.push({ pathname: "/try-on", params: { piece: pieceId } });
  }

  return (
    <View style={styles.page}>
      <StatusBar style={look.status} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: onFloor ? 176 : 56 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: heroH, paddingHorizontal: framed ? 14 : 0, paddingTop: framed ? 12 : 0 }}>
          <ScrollView
            horizontal
            pagingEnabled={!framed}
            snapToInterval={framed ? imgW + 8 : undefined}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / (framed ? imgW + 8 : W)))
            }
          >
            {gallery.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.hero, { width: imgW, height: imgH, borderRadius: framed ? 4 : 0 }]}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          {piece.brandId && typeof selectedStock === "number" && selectedStock > 0 && selectedStock <= 10 ? (
            <View style={[styles.stockBadge, { top: insets.top + 58, left: 16 }]}>
              <Text style={styles.stockBadgeTxt}>{selectedStock} remaining{selectedSize ? ` · ${selectedSize}` : ""}</Text>
            </View>
          ) : null}
          {gallery.length > 1 ? (
            <View style={[styles.count, { top: insets.top + 10 }]}>
              <Text style={styles.countTxt}>
                {String(page + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}
              </Text>
            </View>
          ) : null}
          {runway ? (
            <View style={styles.runway}>
              <Text style={styles.brand}>{brand}</Text>
              <Text style={styles.runwayTitle}>{piece.name}</Text>
              <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { top: insets.top + 6, left: 16 }]} hitSlop={8}>
            <Text style={[styles.iconTxt, { color: look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const nowLiked = !liked;
              app.likePiece(piece.id);
              if (piece.brandId && app.uid) {
                void recordAnalyticsEvent({
                  type: nowLiked ? "listing_like" : "listing_unlike",
                  brandId: piece.brandId,
                  listingId: piece.id,
                  listingName: piece.name,
                  listingPhoto: piece.photo,
                }).catch(() => undefined);
              }
            }}
            style={[styles.heartBtn, { bottom: 16, right: 16 }]}
            hitSlop={8}
          >
            <Text style={[styles.heart, { color: liked ? look.accent : look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>
              {liked ? "♥" : "♡"}
            </Text>
            <Text style={[styles.heartN, { color: look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>{hearts}</Text>
          </Pressable>
        </View>

        {preview && mine ? (
          <Pressable onPress={() => router.back()} style={styles.previewBar}>
            <Text style={styles.previewBarTxt}>Buyer preview</Text>
            <Text style={styles.previewBarGo}>Done</Text>
          </Pressable>
        ) : null}

        <View style={styles.body}>
          {!runway ? (
            <>
              <View style={styles.kicker}>
                <Text style={styles.brand}>{brand}</Text>
                <View style={styles.rule} />
                {piece.status === "sold" ? <Text style={styles.sold}>Sold</Text> : null}
              </View>
              <Text style={styles.title}>{piece.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
                {piece.originalPriceCents > 0 ? (
                  <Text style={styles.was}>{usd(piece.originalPriceCents, piece.currency || "USD")}</Text>
                ) : null}
              </View>
            </>
          ) : null}

          <View style={styles.specs}>
            {sizeOptions.length ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>{inventoryTracked ? "Choose size" : "Size"}</Text>
                <View style={styles.sizeOptions}>
                  {sizeOptions.map((size) => {
                    const stock = piece.sizeStock?.[size];
                    const unavailable = inventoryTracked && typeof stock === "number" && stock <= 0;
                    return (
                      <Pressable
                        key={size}
                        disabled={unavailable}
                        onPress={() => setSelectedSize(size)}
                        style={[styles.sizePill, selectedSize === size && styles.sizePillOn, unavailable && styles.sizePillOff]}
                      >
                        <Text style={[styles.sizeTxt, selectedSize === size && styles.sizeTxtOn, unavailable && styles.sizeTxtOff]}>{size}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {inventoryTracked && typeof selectedStock === "number" && selectedStock <= 0 ? <Text style={styles.stockHint}>This size is sold out.</Text> : null}
              </View>
            ) : null}
            {piece.color ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>Colour</Text>
                <View style={styles.colorRow}>
                  {chip ? <View style={[styles.swatch, { backgroundColor: chip }]} /> : null}
                  <Text style={styles.factV}>{piece.color}</Text>
                </View>
              </View>
            ) : null}
            {piece.condition ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>Condition</Text>
                <Text style={styles.factV}>{piece.condition}</Text>
              </View>
            ) : null}
          </View>

          {piece.notes ? (
            <View style={styles.block}>
              <Text style={styles.section}>About this piece</Text>
              <Text style={styles.notes}>{piece.notes}</Text>
            </View>
          ) : null}

          {piece.material || piece.category ? (
            <View style={styles.block}>
              <Text style={styles.section}>The details</Text>
              <View style={styles.metaRow}>
                {piece.material ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.factK}>Material</Text>
                    <Text style={styles.factV}>{piece.material}</Text>
                  </View>
                ) : null}
                {piece.category ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.factK}>Category</Text>
                    <Text style={styles.factV}>{piece.category}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={owningBrand ? () => router.push({ pathname: "/brand/[id]", params: { id: owningBrand.id } }) : undefined}
            disabled={!owningBrand}
            accessibilityRole={owningBrand ? "button" : undefined}
            accessibilityLabel={owningBrand ? `Open ${owningBrand.name} brand page` : undefined}
            style={styles.seller}
          >
            {sellerPhoto ? (
              <Image source={{ uri: sellerPhoto }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(seller[0] || "U").toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerK}>{sellerLabel}</Text>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerN}>{seller}</Text>
                {owningBrand?.verified && owningBrand.status === "verified" ? <VerifiedMark size={17} /> : null}
              </View>
              <Text style={styles.sellerP}>Ships from {ship.name}</Text>
              <Text style={styles.sellerP}>{shipsToLine(piece.country || app.country, piece.shipsTo)}</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {onFloor && onThisFloor ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]}>
          <Text accessibilityRole="text" style={styles.availabilityNotice}>
            {marketplaceSync === "loading" ? "Checking live availability…" : marketplaceSync === "unavailable" ? "Live availability is unavailable. Checkout is paused until the marketplace reconnects." : !remoteListing ? "This listing is not currently confirmed by Uvel’s marketplace service." : "Live availability confirmed."}
          </Text>
          <Pressable onPress={tryOnMe} style={styles.try}>
            <Text style={styles.tryTxt}>Try on me</Text>
          </Pressable>
          <View style={styles.dockRow}>
            <Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: piece.id } })} style={styles.ask}>
              <Text style={styles.askTxt}>Ask</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id, variantKey: selectedSize, variantLabel: selectedSize, campaignId: typeof campaignId === "string" ? campaignId : "", collectionId: typeof collectionId === "string" ? collectionId : "", promotionId: typeof promotionId === "string" ? promotionId : "", campaignChannel: typeof campaignChannel === "string" ? campaignChannel : "" } })}
              disabled={!canBuy}
              style={[styles.buy, !canBuy && styles.buyOff]}
            >
              <Text style={styles.ctaTxt}>{!availabilityConfirmed ? "Availability unavailable" : !inStock ? "Sold out" : !selectedSize && sizeOptions.length ? "Choose a size" : `Buy · ${usd(piece.listPriceCents, piece.currency || "USD")}`}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {onFloor && !onThisFloor && !mine ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={styles.p}>
            This piece is on the {ship.name} floor. It isn’t for sale in {getMarket(app.country).name}.
          </Text>
          <Pressable
            onPress={() => {
              app.setCountry(ship.code);
            }}
            style={styles.buy}
          >
            <Text style={styles.ctaTxt}>Go to the {ship.name} store</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ownerStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    heroWrap: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
    iconBtn: {
      position: "absolute",
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(18,17,14,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    iconTxt: { color: "#F4F0E6", fontSize: 28, lineHeight: 30, marginTop: -2 },
    badge: {
      position: "absolute",
      right: 16,
      backgroundColor: "#D6E27A",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeTxt: { color: "#16140F", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
    stockBadge: { position: "absolute", left: 16, backgroundColor: "#D6E27A", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, zIndex: 4 },
    stockBadgeTxt: { color: "#16140F", fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
    body: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, textTransform: "uppercase" },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 28, lineHeight: 34, marginTop: 8 },
    price: { color: colors.bone, fontWeight: "700", fontSize: 24, marginTop: 10 },
    meta: { color: colors.muted, fontSize: 14, marginTop: 8 },
    look: { color: colors.subtle, fontSize: 13, marginTop: 10 },
    dock: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 8,
      backgroundColor: colors.ink,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(244,240,230,0.12)",
    },
    edit: {
      height: 52,
      borderRadius: 26,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    editTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
    preview: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.28)",
      alignItems: "center",
      justifyContent: "center",
    },
    previewTxt: { color: colors.bone, fontWeight: "600", fontSize: 15 },
    row: { flexDirection: "row", gap: 8 },
    ghost: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: colors.bone, fontWeight: "600", fontSize: 14 },
  });
}

function make(look: ShopLook) {
  const lightBar = look.status === "dark";
  const line = look.status === "dark" ? "rgba(22,20,15,0.14)" : "rgba(244,240,230,0.16)";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: look.page },
    hero: { backgroundColor: look.surface },
    count: {
      position: "absolute",
      alignSelf: "center",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    countTxt: {
      color: lightBar ? "#16140F" : "#F4F0E6",
      fontSize: 11,
      letterSpacing: 1.6,
      fontWeight: "600",
      backgroundColor: lightBar ? "rgba(244,240,230,0.7)" : "rgba(11,10,8,0.45)",
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    iconBtn: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: lightBar ? "rgba(244,240,230,0.78)" : "rgba(18,17,14,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    iconTxt: { fontSize: 28, lineHeight: 30, marginTop: -2 },
    stockBadge: { position: "absolute", left: 16, backgroundColor: "#D6E27A", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, zIndex: 4 },
    stockBadgeTxt: { color: "#16140F", fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
    heart: { fontSize: 18, marginTop: 1 },
    heartBtn: {
      position: "absolute",
      minWidth: 40,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: lightBar ? "rgba(244,240,230,0.78)" : "rgba(18,17,14,0.5)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    heartN: { fontSize: 13, fontWeight: "700" },
    previewBar: {
      marginHorizontal: 22,
      marginTop: 14,
      marginBottom: 4,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: look.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    previewBarTxt: { color: look.muted, fontSize: 13 },
    previewBarGo: { color: look.bone, fontWeight: "700", fontSize: 13 },
    body: { paddingHorizontal: 22, paddingTop: 20 },
    kicker: { flexDirection: "row", alignItems: "center", gap: 10 },
    brand: { color: look.muted, letterSpacing: 1.8, fontSize: 11, textTransform: "uppercase" },
    rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: look.accent, opacity: 0.55 },
    sold: { color: look.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
    title: { color: look.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 12 },
    runwayTitle: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, lineHeight: 32, marginTop: 6 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 14 },
    price: { color: look.bone, fontWeight: "700", fontSize: 26, letterSpacing: -0.3 },
    was: { color: look.muted, fontSize: 16, textDecorationLine: "line-through" },
    specs: {
      flexDirection: "row",
      gap: 8,
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    spec: { flex: 1, backgroundColor: look.surface, borderRadius: 16, padding: 12 },
    factK: { color: look.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
    factV: { color: look.bone, fontSize: 14, fontWeight: "600", marginTop: 6 },
    sizePill: {
      alignSelf: "auto",
      marginTop: 0,
      borderWidth: 1,
      borderColor: look.accent,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sizeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 },
    sizePillOn: { backgroundColor: look.accent },
    sizePillOff: { opacity: 0.35 },
    sizeTxt: { color: look.bone, fontSize: 13, fontWeight: "700" },
    sizeTxtOn: { color: look.accentInk },
    sizeTxtOff: { textDecorationLine: "line-through" },
    stockHint: { color: look.muted, fontSize: 11, marginTop: 8 },
    colorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    swatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    block: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    section: {
      color: look.muted,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    notes: { color: look.bone, fontSize: 16, lineHeight: 24 },
    metaRow: { flexDirection: "row", gap: 16 },
    seller: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: look.surface },
    avatarTxt: { color: look.accentInk, fontWeight: "700", fontSize: 16 },
    sellerK: { color: look.muted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" },
    sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    sellerN: { color: look.bone, fontSize: 16, fontWeight: "600" },
    sellerP: { color: look.muted, fontSize: 13, marginTop: 2 },
    availabilityNotice: { color: look.muted, fontSize: 12, lineHeight: 18, marginBottom: 2 },
    p: { color: look.muted, lineHeight: 22 },
    ctaTxt: { color: look.accentInk, fontWeight: "700", fontSize: 16 },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: look.page,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
    },
    try: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    tryTxt: { color: look.accent, fontWeight: "700", fontSize: 15 },
    dockRow: { flexDirection: "row", gap: 10 },
    ask: {
      height: 54,
      paddingHorizontal: 22,
      borderRadius: 27,
      backgroundColor: look.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    askTxt: { color: look.bone, fontWeight: "600", fontSize: 16 },
    buy: {
      flex: 1,
      height: 54,
      borderRadius: 27,
      backgroundColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    buyOff: { opacity: 0.45 },
    runway: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 22,
      paddingBottom: 28,
      paddingTop: 64,
      backgroundColor: "rgba(11,10,8,0.42)",
    },
  });
}
