import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { getBrand, type Brand } from "../lib/brands";
import { addToCart, useCart } from "../lib/cart";
import { getMarket, moneyInMarket } from "../lib/markets";
import { payMethods, type PayMethod } from "../lib/fees";
import { loadLastPaymentMethod } from "../lib/paymentPreference";
import { useUvel } from "../lib/store";
import type { ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { MARKET_RED, useColors, type Colors } from "../lib/theme";
import { BrandVerifiedMark } from "./VerifiedMark";
import { TodayCartFab } from "./TodayCartFab";
import { FriendShareSheet, type FriendSharePayload } from "./FriendShareSheet";

export type ListingOrigin = { x: number; y: number; width: number; height: number; radius?: number; radii?: [number, number, number, number]; photo?: string; measure?: (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => void };
type Props = { piece: ClosetPiece; origin: ListingOrigin; onClose: () => void; onInteraction?: (action: PersonalizationAction, piece: ClosetPiece, query?: string, dwellSeconds?: number) => void; previewOnly?: boolean; showDoubleTapHint?: boolean; onDoubleTapHintDismiss?: () => void; firstListing?: boolean; reserveTabBarSpace?: boolean };

export function TodayListingOverlay({ piece, onClose, onInteraction, previewOnly = false, reserveTabBarSpace = false }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);
  const app = useUvel();
  const cart = useCart();
  const brand = piece.brandId ? getBrand(piece.brandId) : undefined;
  const market = getMarket(app.country);
  const methods = payMethods(market.code);
  const [paymentMethodId, setPaymentMethodId] = useState(methods[0]?.id || "card");
  useEffect(() => {
    let live = true;
    void loadLastPaymentMethod(market.code).then((last) => {
      if (live && last && methods.some((method) => method.id === last)) setPaymentMethodId(last);
    });
    return () => { live = false; };
  }, [market.code]);
  const paymentMethod = methods.find((method) => method.id === paymentMethodId) || methods[0];
  const footerBottom = reserveTabBarSpace ? 64 + Math.max(insets.bottom, 8) : Math.max(insets.bottom, 8);
  const paymentButtonLabel = paymentMethod?.kind === "apple"
    ? "Pay"
    : paymentMethod?.kind === "card"
      ? "Pay with card"
      : paymentMethod
        ? `Pay with ${paymentMethod.label}`
        : "Buy now";
  const sellerId = piece.ownerId || piece.listedByUid || "";
  const sellerName = brand?.name || piece.ownerName || piece.listedByName || "Uvel seller";
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];
  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedSize, setSelectedSize] = useState(piece.size || piece.sizes?.[0] || "One size");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastPhotoTap = useRef(0);
  const [shareOpen, setShareOpen] = useState(false);
  const inBag = cart.has(piece.id);
  const currentPhoto = gallery[Math.min(activePhoto, gallery.length - 1)] || piece.photo;
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.` };
  const sizes = piece.sizes?.length ? piece.sizes : [piece.size || "One size"];
  const buyNow = () => { if (!previewOnly) router.push({ pathname: "/checkout/[id]", params: { id: piece.id } }); };
  const addItem = () => { if (previewOnly || inBag) return; addToCart(piece.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); };
  const toggleSaved = () => { app.toggleSaved(piece.id); onInteraction?.("save", piece); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const saveFromPhotoDoubleTap = () => { if (!app.saved.includes(piece.id)) { app.toggleSaved(piece.id); onInteraction?.("save", piece); } void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const handlePhotoPress = () => { const now = Date.now(); if (lastPhotoTap.current !== 0 && now - lastPhotoTap.current <= 300) { lastPhotoTap.current = 0; saveFromPhotoDoubleTap(); return; } lastPhotoTap.current = now; };
  const openSeller = () => { if (brand?.id) router.push({ pathname: "/brand/[id]", params: { id: brand.id } }); else if (sellerId) router.push({ pathname: "/seller/[id]", params: { id: sellerId } }); };
  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close listing details" />
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing"><Ionicons name="chevron-down" size={27} color={colors.bone} /></Pressable>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}><Pressable style={StyleSheet.absoluteFill} onPress={handlePhotoPress} accessibilityRole="image" accessibilityLabel={`${piece.name} photo`} accessibilityHint="Double tap to save this listing."><Image source={{ uri: currentPhoto }} style={styles.heroImage} contentFit="cover" /></Pressable>{gallery.length > 1 ? <View style={styles.dots}>{gallery.map((photo, index) => <Pressable key={`${photo}-${index}`} onPress={() => setActivePhoto(index)} style={[styles.dot, index === activePhoto && styles.dotActive]} accessibilityLabel={`View photo ${index + 1}`} />)}</View> : null}<Pressable onPress={toggleSaved} style={styles.like} accessibilityRole="button" accessibilityLabel="Like listing" accessibilityState={{ selected: app.saved.includes(piece.id) }}><Ionicons name={app.saved.includes(piece.id) ? "heart" : "heart-outline"} size={22} color={app.saved.includes(piece.id) ? MARKET_RED : colors.bone} /></Pressable><Pressable onPress={() => setShareOpen(true)} style={styles.share} accessibilityRole="button" accessibilityLabel={`Share ${piece.name}`}><Ionicons name="share-outline" size={22} color={colors.bone} /></Pressable></View>
          {gallery.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>{gallery.map((photo, index) => <Pressable key={`${photo}-thumb`} onPress={() => setActivePhoto(index)} style={[styles.thumb, index === activePhoto && styles.thumbActive]} accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}`}><Image source={{ uri: photo }} style={styles.thumbImage} contentFit="cover" /></Pressable>)}</ScrollView> : null}
          <View style={styles.info}>
            <View style={styles.titleRow}><Text style={styles.title}>{piece.name}</Text></View>
            <View style={styles.priceRow}><Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text><Text style={styles.condition}>{piece.condition || "Excellent"}</Text><Text style={styles.available}>Available</Text></View>
            <Text style={styles.label}>Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeRail}>{sizes.map((size) => <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.size, selectedSize === size && styles.sizeSelected]} accessibilityRole="button" accessibilityState={{ selected: selectedSize === size }}><Text style={[styles.sizeText, selectedSize === size && styles.sizeTextSelected]}>{size}</Text></Pressable>)}</ScrollView>
            <Pressable onPress={() => setDetailsOpen((open) => !open)} style={styles.details} accessibilityRole="button" accessibilityLabel="Product details"><View style={styles.detailsTitle}><Ionicons name="shirt-outline" size={18} color={colors.bone} /><Text style={styles.detailsText}>Product Details</Text></View><Ionicons name={detailsOpen ? "chevron-up" : "chevron-forward"} size={19} color={colors.bone} /></Pressable>
            {detailsOpen ? <View style={styles.detailsBody}><Fact styles={styles} label="Color" value={piece.color || "Original"} /><Fact styles={styles} label="Material" value={piece.material || "Not specified"} /><Fact styles={styles} label="Listed by" value={sellerName} /></View> : null}
            <View style={styles.seller}><View style={styles.sellerTop}><Pressable onPress={openSeller} disabled={!brand?.id && !sellerId} style={styles.sellerTap} accessibilityRole={brand?.id || sellerId ? "button" : undefined}>{brand?.logoUri || piece.ownerPhoto ? <Image source={{ uri: brand?.logoUri || piece.ownerPhoto }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.sellerCopy}><Text style={styles.sellerLabel}>{brand ? "Sold by" : "Listed by"}</Text><View style={styles.sellerNameRow}><Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text><BrandVerifiedMark brand={brand as Brand | undefined} size={13} /></View><Text style={styles.sellerMeta}>Trusted seller · buyer protection</Text></View></Pressable><Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: piece.id, pieceName: piece.name, piecePhoto: piece.photo, piecePriceCents: String(piece.listPriceCents), ...(brand?.id ? { brandId: brand.id } : {}) } })} style={styles.messageButton} accessibilityRole="button" accessibilityLabel={`Message ${sellerName}`}><Ionicons name="chatbubble-outline" size={17} color={colors.bone} /><Text style={styles.messageText}>Message</Text></Pressable></View><View style={styles.sellerRating}><Text style={styles.stars}>★★★★★</Text><Text style={styles.reviewCount}>({piece.likedBy?.length || 0})</Text></View></View>
            <View style={styles.descriptionSection}><Text style={styles.descriptionTitle}>Description</Text><Text style={styles.description}>{piece.notes?.trim() || "The seller hasn’t added a description yet."}</Text></View>
          </View>
        </ScrollView>
        {!previewOnly ? <View style={[styles.footer, { bottom: footerBottom }]}><Pressable onPress={buyNow} style={styles.buyButton} accessibilityRole="button" accessibilityLabel={`${paymentButtonLabel} for ${piece.name}`}><View style={styles.buyContent}><PaymentMark method={paymentMethod} colors={colors} /><Text style={styles.buyText}>{paymentButtonLabel}</Text></View></Pressable><Pressable onPress={addItem} style={styles.bagButton} accessibilityRole="button" accessibilityLabel={inBag ? `${piece.name} is in your bag` : `Add ${piece.name} to bag`}><Text style={styles.bagText}>{inBag ? "In bag" : "Add to cart"}</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/try-on", params: { piece: piece.id } })} style={styles.tryOnButton} accessibilityRole="button" accessibilityLabel={`Try on ${piece.name}`} accessibilityHint="Opens the virtual try-on experience for this item."><Ionicons name="body-outline" size={20} color={colors.bone} /></Pressable></View> : null}
      </View>
      <TodayCartFab listingOpen showWhileListing={!previewOnly} onBeforeOpen={onClose} />
      <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void Share.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
    </View>
  );
}
function PaymentMark({ method, colors }: { method?: PayMethod; colors: Colors }) {
  if (!method) return null;
  const source = method.icon === "card" ? require("../assets/pay/card.png") : method.icon === "momo" ? require("../assets/pay/mtn-momo.png") : method.icon === "telecel" ? require("../assets/pay/telecel.png") : null;
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateY: -2 }] }}>
      {method.icon === "apple" ? (
        <Ionicons name="logo-apple" size={20} color={colors.bone} />
      ) : source ? (
        <Image source={source} style={{ width: 22, height: 20 }} contentFit="contain" />
      ) : (
        <View style={{ width: 22, height: 18, borderRadius: 4, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.ink, fontSize: 10, fontWeight: "900" }}>{method.label.slice(0, 1)}</Text>
        </View>
      )}
    </View>
  );
}
function Fact({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function makeStyles(colors: Colors) { return StyleSheet.create({ root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 }, backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { flex: 1, marginTop: 0, backgroundColor: colors.ink, overflow: "hidden", zIndex: 2, elevation: 10 }, header: { height: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` }, back: { width: 30, alignItems: "flex-start", justifyContent: "center" }, bag: { width: 27, alignItems: "flex-end" }, content: { flex: 1 }, contentContainer: { paddingBottom: 150 }, hero: { width: "100%", aspectRatio: 0.92, backgroundColor: colors.surface, position: "relative", overflow: "hidden" }, heroImage: { width: "100%", height: "100%" }, dots: { position: "absolute", bottom: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.subtle }, dotActive: { backgroundColor: colors.bone, width: 12 }, like: { position: "absolute", left: 14, bottom: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 }, share: { position: "absolute", right: 14, bottom: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 }, thumbs: { gap: 7, paddingHorizontal: 12, paddingTop: 9 }, thumb: { width: 54, height: 54, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: colors.subtle }, thumbActive: { borderWidth: 2, borderColor: colors.bone }, thumbImage: { width: "100%", height: "100%" }, info: { paddingHorizontal: 16, paddingTop: 9 }, titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, title: { flex: 1, color: colors.bone, fontSize: 13, lineHeight: 17 }, rating: { flexDirection: "row", alignItems: "center", gap: 3 }, stars: { color: "#eeb100", fontSize: 15, letterSpacing: 0.5 }, reviewCount: { color: colors.bone, fontSize: 10, textDecorationLine: "underline" }, priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }, price: { color: MARKET_RED, fontSize: 17, fontWeight: "800" }, condition: { color: colors.bone, backgroundColor: colors.neutral, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: "700" }, available: { color: colors.muted, fontSize: 11 }, promo: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 6 }, promoStrong: { color: MARKET_RED, fontWeight: "800" }, label: { color: colors.bone, fontSize: 11, fontWeight: "800", marginTop: 13 }, sizeRail: { gap: 7, paddingTop: 8, paddingBottom: 2 }, size: { minWidth: 42, height: 36, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.subtle, borderRadius: 4, alignItems: "center", justifyContent: "center" }, sizeSelected: { backgroundColor: colors.bone, borderColor: colors.bone }, sizeText: { color: colors.bone, fontSize: 11 }, sizeTextSelected: { color: colors.ink, fontWeight: "800" }, details: { height: 51, borderWidth: 1, borderColor: colors.subtle, borderRadius: 8, marginTop: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsTitle: { flexDirection: "row", alignItems: "center", gap: 8 }, detailsText: { color: colors.bone, fontSize: 13, fontWeight: "800" }, detailsBody: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderTopWidth: 0, borderColor: colors.subtle, paddingHorizontal: 12, paddingBottom: 6 }, fact: { width: "50%", paddingVertical: 10 }, factLabel: { color: colors.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }, factValue: { color: colors.bone, fontSize: 12, fontWeight: "700", marginTop: 3 }, seller: { marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: `${colors.bone}20` }, sellerTop: { flexDirection: "row", alignItems: "center", gap: 10 }, sellerTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, messageButton: { height: 36, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.subtle, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 5 }, messageText: { color: colors.bone, fontSize: 11, fontWeight: "800" }, sellerRating: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 50, marginTop: 8 }, avatar: { width: 40, height: 40, borderRadius: 20 }, avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ded3c5", alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.bone, fontSize: 17, fontWeight: "800" }, sellerCopy: { flex: 1 }, sellerLabel: { color: colors.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }, sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }, sellerName: { color: colors.bone, fontSize: 13, fontWeight: "800", flexShrink: 1 }, sellerMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, descriptionSection: { marginTop: 4, paddingTop: 14, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}20` }, descriptionTitle: { color: colors.bone, fontSize: 13, fontWeight: "800", marginBottom: 6 }, description: { color: colors.muted, fontSize: 13, lineHeight: 20 }, buyContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 5 }, footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.ink, paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }, buyButton: { width: 148, height: 48, borderWidth: 1, borderColor: colors.bone, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }, buyText: { color: colors.bone, fontSize: 14, fontWeight: "800" }, bagButton: { flex: 1, height: 48, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone }, tryOnButton: { width: 44, height: 48, borderWidth: 1, borderColor: colors.subtle, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }, bagText: { color: colors.ink, fontSize: 14, fontWeight: "800" }, heartButton: { width: 48, height: 48, borderWidth: 1, borderColor: colors.subtle, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink } }); }
