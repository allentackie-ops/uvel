import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { getBrand, type Brand } from "../lib/brands";
import { addToCart, useCart } from "../lib/cart";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import type { ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { BrandVerifiedMark } from "./VerifiedMark";
import { FriendShareSheet, type FriendSharePayload } from "./FriendShareSheet";

export type ListingOrigin = { x: number; y: number; width: number; height: number; radius?: number; radii?: [number, number, number, number]; photo?: string; measure?: (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => void };

type Props = {
  piece: ClosetPiece;
  origin: ListingOrigin;
  onClose: () => void;
  onInteraction?: (action: PersonalizationAction, piece: ClosetPiece, query?: string, dwellSeconds?: number) => void;
  previewOnly?: boolean;
  showDoubleTapHint?: boolean;
  onDoubleTapHintDismiss?: () => void;
  firstListing?: boolean;
};

export function TodayListingOverlay({ piece, onClose, onInteraction, previewOnly = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const cart = useCart();
  const brand = piece.brandId ? getBrand(piece.brandId) : undefined;
  const sellerId = piece.ownerId || piece.listedByUid || "";
  const market = getMarket(app.country);
  const sellerName = brand?.name || piece.ownerName || piece.listedByName || "Uvel seller";
  const sellerLocation = piece.country ? getMarket(piece.country).name : market.name;
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];
  const [activePhoto, setActivePhoto] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const inBag = cart.has(piece.id);
  const currentPhoto = gallery[Math.min(activePhoto, gallery.length - 1)] || piece.photo;
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.` };

  function buyNow() {
    if (previewOnly) return;
    router.push({ pathname: "/checkout/[id]", params: { id: piece.id } });
  }

  function addItem() {
    if (previewOnly || inBag) return;
    addToCart(piece.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }

  function openMessage() {
    router.push({ pathname: "/ask/[id]", params: { id: piece.id, pieceName: piece.name, piecePhoto: piece.photo, piecePriceCents: String(piece.listPriceCents), ...(brand?.id ? { brandId: brand.id } : {}) } });
  }

  function openSeller() {
    if (brand?.id) router.push({ pathname: "/brand/[id]", params: { id: brand.id } });
    else if (sellerId) router.push({ pathname: "/seller/[id]", params: { id: sellerId } });
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close listing details" />
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Back to listings"><Ionicons name="arrow-back" size={23} color={colors.bone} /></Pressable>
          <Text style={styles.headerTitle}>Details</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => { onInteraction?.("save", piece); }} hitSlop={8} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Save listing"><Ionicons name="heart-outline" size={22} color={colors.bone} /></Pressable>
            <Pressable onPress={() => setShareOpen(true)} hitSlop={8} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={`Share ${piece.name}`}><Ionicons name="share-outline" size={22} color={colors.bone} /></Pressable>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBlock}>
            <Text style={styles.brandName}>{brand?.name || piece.brand || "Uvel listing"}</Text>
            <Text style={styles.title}>{piece.name}</Text>
            <Text style={styles.meta}>{[piece.category, piece.condition, piece.material].filter(Boolean).join(" · ")}</Text>
          </View>

          <View style={styles.heroFrame}>
            <Image source={{ uri: currentPhoto }} style={styles.heroImage} contentFit="contain" />
            {gallery.length > 1 ? <View style={styles.photoCount}><Text style={styles.photoCountText}>{activePhoto + 1}/{gallery.length}</Text></View> : null}
          </View>
          {gallery.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRail}>{gallery.map((photo, index) => <Pressable key={`${photo}-${index}`} onPress={() => setActivePhoto(index)} style={[styles.thumbnail, activePhoto === index && styles.thumbnailActive]}><Image source={{ uri: photo }} style={styles.thumbnailImage} contentFit="cover" /></Pressable>)}</ScrollView> : null}

          <View style={styles.tagRow}><Text style={styles.conditionTag}>{piece.condition || "Excellent"}</Text><Text style={styles.availability}>Available</Text></View>
          <View style={styles.optionSection}><Text style={styles.sectionTitle}>Color <Text style={styles.sectionStrong}>{piece.color || "Original"}</Text></Text></View>
          <View style={styles.optionSection}><Text style={styles.sectionTitle}>Size <Text style={styles.sectionStrong}>{piece.size || "Select one"}</Text></Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeRail}>{(piece.sizes?.length ? piece.sizes : [piece.size || "One size"]).map((size) => <View key={size} style={[styles.sizeCard, size === piece.size && styles.sizeCardActive]}><Text style={styles.sizeText}>{size}</Text>{size === piece.size ? <Text style={styles.sizeMeta}>Selected</Text> : null}</View>)}</ScrollView></View>

          <View style={styles.priceBlock}><Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text><Text style={styles.payment}><Text style={styles.bold}>Unlock a $50 Gift Card:</Text> Apply and pay securely with Uvel.</Text><Text style={styles.shipping}>Ships from {sellerLocation} · <Text style={styles.link}>See delivery details</Text></Text></View>

          {!previewOnly ? <Pressable onPress={() => router.push({ pathname: "/try-on", params: { piece: piece.id } })} style={styles.tryOn} accessibilityRole="button"><Ionicons name="body-outline" size={19} color={colors.bone} /><Text style={styles.tryOnText}>Try it on</Text></Pressable> : null}

          <View style={styles.sellerCard}>
            <Pressable onPress={openSeller} disabled={!brand?.id && !sellerId} style={styles.sellerTap} accessibilityRole={brand?.id || sellerId ? "button" : undefined}>
              {brand?.logoUri || piece.ownerPhoto ? <Image source={{ uri: brand?.logoUri || piece.ownerPhoto }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}
              <View style={styles.sellerCopy}><Text style={styles.sellerEyebrow}>{brand ? "Sold by" : "Listed by"}</Text><View style={styles.sellerNameRow}><Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text><BrandVerifiedMark brand={brand as Brand | undefined} size={14} /></View><Text style={styles.sellerMeta}>Ships from {sellerLocation}</Text></View>
            </Pressable>
            <Pressable onPress={openMessage} style={styles.messageButton} accessibilityRole="button"><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.bone} /><Text style={styles.messageText}>Message</Text></Pressable>
          </View>

          {piece.notes ? <View style={styles.description}><Text style={styles.descriptionLabel}>Description</Text><Text style={styles.descriptionText}>{piece.notes}</Text></View> : null}
          <View style={styles.accordionGroup}>
            <Pressable onPress={() => setMeasurementsOpen((open) => !open)} style={styles.accordionRow} accessibilityRole="button"><Text style={styles.accordionTitle}>Measurements & fit</Text><Ionicons name={measurementsOpen ? "chevron-up" : "chevron-down"} size={19} color={colors.bone} /></Pressable>
            {measurementsOpen ? <Text style={styles.accordionBody}>Ask the seller for exact measurements and fit guidance.</Text> : null}
            <Pressable onPress={() => setShippingOpen((open) => !open)} style={styles.accordionRow} accessibilityRole="button"><Text style={styles.accordionTitle}>Shipping & returns</Text><Ionicons name={shippingOpen ? "chevron-up" : "chevron-down"} size={19} color={colors.bone} /></Pressable>
            {shippingOpen ? <Text style={styles.accordionBody}>Delivery and return details are confirmed at checkout.</Text> : null}
          </View>
        </ScrollView>

        {!previewOnly ? <View style={[styles.purchaseFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}><Pressable onPress={buyNow} style={styles.buyButton} accessibilityRole="button" accessibilityLabel={`Buy ${piece.name} now`}><Text style={styles.buyButtonText}>Buy now</Text></Pressable><Pressable onPress={addItem} style={styles.cartButton} accessibilityRole="button" accessibilityLabel={inBag ? `${piece.name} is in your cart` : `Add ${piece.name} to cart`}><Text style={styles.cartButtonText}>{inBag ? "In cart" : "Add to cart"}</Text></Pressable></View> : null}
      </View>
      <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void Share.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: { flex: 1, marginTop: 42, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", zIndex: 2, elevation: 10 },
    header: { height: 58, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}24`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerButton: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: colors.bone, fontSize: 17, fontWeight: "900" },
    headerActions: { flexDirection: "row", gap: 4 },
    content: { flex: 1 },
    contentContainer: { paddingBottom: 24 },
    titleBlock: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    brandName: { color: colors.success, fontSize: 13, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
    title: { color: colors.bone, fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 7 },
    meta: { color: colors.muted, fontSize: 14, marginTop: 6 },
    heroFrame: { height: 330, marginHorizontal: 12, borderRadius: 18, overflow: "hidden", backgroundColor: colors.ink, position: "relative" },
    heroImage: { width: "100%", height: "100%" },
    photoCount: { position: "absolute", right: 12, bottom: 12, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
    photoCountText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    thumbnailRail: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
    thumbnail: { width: 58, height: 58, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: `${colors.bone}25` },
    thumbnailActive: { borderWidth: 2, borderColor: colors.success },
    thumbnailImage: { width: "100%", height: "100%" },
    tagRow: { paddingHorizontal: 16, paddingTop: 15, flexDirection: "row", alignItems: "center", gap: 10 },
    conditionTag: { color: colors.successInk, backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 17, fontSize: 13, fontWeight: "900" },
    availability: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    optionSection: { paddingTop: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    sectionTitle: { color: colors.bone, fontSize: 16, fontWeight: "800", paddingHorizontal: 16 },
    sectionStrong: { fontWeight: "900" },
    sizeRail: { gap: 8, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 13 },
    sizeCard: { minWidth: 76, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: `${colors.bone}45`, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    sizeCardActive: { borderWidth: 2, borderColor: colors.success, backgroundColor: `${colors.success}20` },
    sizeText: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    sizeMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
    priceBlock: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    price: { color: colors.bone, fontSize: 28, fontWeight: "900" },
    payment: { color: colors.bone, fontSize: 14, lineHeight: 21, marginTop: 12 },
    bold: { fontWeight: "900" },
    shipping: { color: colors.bone, fontSize: 14, lineHeight: 21, marginTop: 7 },
    link: { color: colors.success, fontWeight: "800" },
    tryOn: { alignSelf: "flex-start", marginHorizontal: 16, marginTop: 16, minHeight: 44, paddingHorizontal: 18, borderRadius: 23, borderWidth: 1, borderColor: `${colors.bone}44`, flexDirection: "row", alignItems: "center", gap: 8 },
    tryOnText: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    sellerCard: { margin: 16, padding: 12, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}28`, flexDirection: "row", alignItems: "center", gap: 10 },
    sellerTap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.successInk, fontSize: 18, fontWeight: "900" },
    sellerCopy: { flex: 1, minWidth: 0 },
    sellerEyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
    sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "900", flexShrink: 1 },
    sellerMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    messageButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 20, borderWidth: 1, borderColor: `${colors.bone}45`, flexDirection: "row", alignItems: "center", gap: 5 },
    messageText: { color: colors.bone, fontSize: 13, fontWeight: "800" },
    description: { marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 15, backgroundColor: `${colors.bone}08` },
    descriptionLabel: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
    descriptionText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
    accordionGroup: { marginHorizontal: 16, borderTopWidth: 1, borderTopColor: `${colors.bone}22` },
    accordionRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: `${colors.bone}22`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    accordionTitle: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    accordionBody: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 12 },
    purchaseFooter: { flexDirection: "row", gap: 9, paddingHorizontal: 14, paddingTop: 11, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: `${colors.bone}28`, zIndex: 20, elevation: 20 },
    buyButton: { flex: 1, minHeight: 52, borderRadius: 27, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    buyButtonText: { color: colors.successInk, fontSize: 16, fontWeight: "900" },
    cartButton: { flex: 1, minHeight: 52, borderRadius: 27, backgroundColor: colors.pulse, alignItems: "center", justifyContent: "center" },
    cartButtonText: { color: colors.pulseInk, fontSize: 16, fontWeight: "900" },
  });
}
