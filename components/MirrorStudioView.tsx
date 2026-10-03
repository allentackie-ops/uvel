import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "./ListingCard";
import { CATEGORIES } from "../lib/catalog";
import type { ClosetPiece } from "../lib/wardrobe";
import { useColors, type Colors } from "../lib/theme";

export type MirrorStudioViewProps = {
  standalone: boolean;
  personUri: string | null;
  resultUri: string | null;
  garmentUri: string | null;
  garmentName: string;
  error: string;
  busy: boolean;
  pieces: ClosetPiece[];
  marketplaceUnavailable: boolean;
  retryingMarketplace: boolean;
  link: string;
  linkBusy: boolean;
  showLink: boolean;
  onBack: () => void;
  onAddPerson: () => void;
  onChangePerson: () => void;
  onRemovePerson: () => void;
  onPickPiece: (piece: ClosetPiece) => void;
  onPickPhoto: () => void;
  onClearGarment: () => void;
  onChangeLink: (value: string) => void;
  onOpenLink: () => void;
  onCloseLink: () => void;
  onUseLink: () => void;
  onTryOn: () => void;
  onShare: () => void;
  onRetryMarketplace: () => void;
};

export function MirrorStudioView({
  standalone,
  personUri,
  resultUri,
  garmentUri,
  garmentName,
  error,
  busy,
  pieces,
  marketplaceUnavailable,
  retryingMarketplace,
  link,
  linkBusy,
  showLink,
  onBack,
  onAddPerson,
  onChangePerson,
  onRemovePerson,
  onPickPiece,
  onPickPhoto,
  onClearGarment,
  onChangeLink,
  onOpenLink,
  onCloseLink,
  onUseLink,
  onTryOn,
  onShare,
  onRetryMarketplace,
}: MirrorStudioViewProps) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [uvelPickerOpen, setUvelPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const visiblePieces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pieces.filter((piece) => {
      if (category !== "All" && piece.category !== category) return false;
      if (!needle) return true;
      return piece.name.toLowerCase().includes(needle)
        || (piece.brand || "").toLowerCase().includes(needle)
        || (piece.color || "").toLowerCase().includes(needle);
    });
  }, [category, pieces, query]);

  const displayUri = resultUri || personUri;
  const primaryLabel = busy
    ? "Preparing your look…"
    : !personUri
      ? "Add your photo"
      : !garmentUri
        ? "Choose a piece"
        : "Try this look";

  function runPrimaryAction() {
    if (busy) return;
    if (!personUri) {
      onAddPerson();
      return;
    }
    if (!garmentUri) {
      setUvelPickerOpen(true);
      return;
    }
    onTryOn();
  }

  function choosePiece(piece: ClosetPiece) {
    onPickPiece(piece);
    setUvelPickerOpen(false);
    setQuery("");
    setCategory("All");
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {displayUri ? (
        <Image
          cachePolicy="memory-disk"
          source={{ uri: displayUri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      ) : (
        <View style={styles.emptyCanvas}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-outline" size={36} color={colors.success} />
          </View>
          <Text style={styles.emptyTitle}>Your Mirror studio</Text>
          <Text style={styles.emptyCopy}>Add a full-length photo to preview a look on you.</Text>
          <Pressable onPress={onAddPerson} style={styles.emptyButton} accessibilityRole="button">
            <Ionicons name="camera-outline" size={18} color={colors.successInk} />
            <Text style={styles.emptyButtonText}>Add your photo</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {standalone ? (
          <Pressable onPress={onBack} style={styles.topButton} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={21} color={colors.bone} />
          </Pressable>
        ) : <View style={styles.topButton} />}
        <Text style={styles.topTitle}>Mirror</Text>
        <View style={styles.topButton} />
      </View>

      {personUri && !busy ? (
        <View style={[styles.photoActions, { top: insets.top + 62 }]}>
          <Pressable onPress={onChangePerson} style={styles.photoAction} accessibilityRole="button" accessibilityLabel="Change your photo">
            <Ionicons name="image-outline" size={15} color={colors.bone} />
            <Text style={styles.photoActionText}>Change photo</Text>
          </Pressable>
          <Pressable onPress={onRemovePerson} style={styles.photoAction} accessibilityRole="button" accessibilityLabel="Remove your photo">
            <Ionicons name="close" size={16} color={colors.bone} />
          </Pressable>
        </View>
      ) : null}

      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.busyText}>Dressing you in {garmentName}…</Text>
        </View>
      ) : null}

      <View style={[styles.drawer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.drawerHeading}>
          <View style={styles.lookCopy}>
            <Text style={styles.eyebrow}>YOUR LOOK</Text>
            <Text style={styles.lookTitle} numberOfLines={1}>{garmentUri ? garmentName : "Choose a piece to try"}</Text>
          </View>
          {garmentUri ? (
            <View style={styles.selectedWrap}>
              <Image source={{ uri: garmentUri }} style={styles.selectedImage} contentFit="cover" />
              <Pressable onPress={onClearGarment} style={styles.removeGarment} accessibilityRole="button" accessibilityLabel="Remove selected clothing">
                <Ionicons name="close" size={13} color={colors.bone} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.selectedPlaceholder}><Ionicons name="shirt-outline" size={22} color={colors.success} /></View>
          )}
        </View>

        <View style={styles.sourceRow}>
          <Pressable onPress={() => setUvelPickerOpen(true)} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Choose a piece from Uvel">
            <Ionicons name="pricetag-outline" size={19} color={colors.success} />
            <Text style={styles.sourceLabel}>From Uvel</Text>
          </Pressable>
          <Pressable onPress={onPickPhoto} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Choose and crop a clothing photo">
            <Ionicons name="images-outline" size={19} color={colors.success} />
            <Text style={styles.sourceLabel}>Photos</Text>
          </Pressable>
          <Pressable onPress={onOpenLink} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Paste a clothing item link">
            <Ionicons name="link-outline" size={19} color={colors.success} />
            <Text style={styles.sourceLabel}>Paste link</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resultUri ? (
          <Pressable onPress={onShare} style={styles.shareButton} accessibilityRole="button">
            <Ionicons name="share-outline" size={16} color={colors.bone} />
            <Text style={styles.shareText}>Share your look</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={runPrimaryAction}
          disabled={busy}
          style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          {!busy ? <Ionicons name="arrow-forward" size={18} color={colors.successInk} /> : null}
        </Pressable>
      </View>

      <Modal visible={uvelPickerOpen} transparent animationType="slide" onRequestClose={() => setUvelPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setUvelPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close Uvel picker" />
          <View style={[styles.pickerSheet, { height: Math.min(screenHeight * 0.84, 760), paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose a piece</Text>
                <Text style={styles.modalSubTitle}>Pick something from Uvel</Text>
              </View>
              <Pressable onPress={() => setUvelPickerOpen(false)} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={21} color={colors.bone} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.subtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search pieces"
                placeholderTextColor={colors.subtle}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search Uvel pieces"
              />
              {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.map((value) => {
                const active = value === category;
                return (
                  <Pressable key={value} onPress={() => setCategory(value)} style={[styles.categoryChip, active && styles.categoryChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{value}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {pieces.length ? (
              <FlatList
                data={visiblePieces}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.pickerRow}
                contentContainerStyle={styles.pickerList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.pickerCell}>
                    <ListingCard piece={item} framed onOpen={() => choosePiece(item)} />
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyListText}>No pieces match that search.</Text>}
              />
            ) : (
              <View style={styles.noPieces}>
                <Ionicons name="shirt-outline" size={28} color={colors.success} />
                <Text style={styles.emptyListText}>No Uvel pieces are available right now.</Text>
                {marketplaceUnavailable ? (
                  <Pressable onPress={onRetryMarketplace} style={styles.retryButton} disabled={retryingMarketplace}>
                    <Text style={styles.retryText}>{retryingMarketplace ? "Reconnecting…" : "Retry connection"}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showLink} transparent animationType="slide" onRequestClose={onCloseLink}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.backdrop} onPress={onCloseLink} accessibilityRole="button" accessibilityLabel="Close link entry" />
          <View style={[styles.linkSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paste a link</Text>
                <Text style={styles.modalSubTitle}>Use a clothing image or product page</Text>
              </View>
              <Pressable onPress={onCloseLink} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={21} color={colors.bone} />
              </Pressable>
            </View>
            <View style={styles.linkInputRow}>
              <TextInput
                value={link}
                onChangeText={onChangeLink}
                placeholder="Paste the item URL"
                placeholderTextColor={colors.subtle}
                style={styles.linkInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={onUseLink}
                accessibilityLabel="Clothing item URL"
              />
              <Pressable onPress={onUseLink} disabled={linkBusy || !link.trim()} style={[styles.findLinkButton, (linkBusy || !link.trim()) && styles.findLinkButtonDisabled]}>
                {linkBusy ? <ActivityIndicator size="small" color={colors.successInk} /> : <Ionicons name="arrow-forward" size={18} color={colors.successInk} />}
              </Pressable>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    emptyCanvas: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 240 },
    emptyIcon: { width: 76, height: 76, borderRadius: 24, borderWidth: 1, borderColor: `${colors.success}77`, backgroundColor: `${colors.success}12`, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    emptyTitle: { color: colors.bone, fontSize: 25, fontWeight: "800", textAlign: "center" },
    emptyCopy: { color: `${colors.bone}A3`, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 270 },
    emptyButton: { height: 46, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 23, backgroundColor: colors.success, marginTop: 20 },
    emptyButtonText: { color: colors.successInk, fontWeight: "800", fontSize: 14 },
    topBar: { position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    topButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.ink}A6`, borderWidth: 1, borderColor: `${colors.bone}20` },
    topTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 8 },
    photoActions: { position: "absolute", zIndex: 2, right: 14, flexDirection: "row", gap: 8 },
    photoAction: { height: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: `${colors.ink}C7`, borderWidth: 1, borderColor: `${colors.bone}30` },
    photoActionText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    busyOverlay: { ...StyleSheet.absoluteFill, zIndex: 3, backgroundColor: `${colors.ink}77`, alignItems: "center", justifyContent: "center", paddingBottom: 250 },
    busyText: { color: colors.bone, fontSize: 14, fontWeight: "700", marginTop: 12, textAlign: "center", paddingHorizontal: 24 },
    drawer: { position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 0, paddingTop: 9, paddingHorizontal: 18, backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: `${colors.bone}20` },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: `${colors.bone}45`, alignSelf: "center", marginBottom: 14 },
    drawerHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
    lookCopy: { flex: 1 },
    eyebrow: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
    lookTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 4 },
    selectedWrap: { position: "relative" },
    selectedImage: { width: 48, height: 58, borderRadius: 12, backgroundColor: colors.surface },
    removeGarment: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}3A`, alignItems: "center", justifyContent: "center" },
    selectedPlaceholder: { width: 48, height: 58, borderRadius: 12, borderWidth: 1, borderColor: `${colors.success}4D`, backgroundColor: `${colors.success}10`, alignItems: "center", justifyContent: "center" },
    sourceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    sourceButton: { flex: 1, minHeight: 60, paddingHorizontal: 5, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}22`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 5 },
    sourceLabel: { color: colors.bone, fontSize: 11, fontWeight: "700" },
    errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginBottom: 8 },
    shareButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 7 },
    shareText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    primaryButton: { height: 52, borderRadius: 26, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryButtonBusy: { opacity: 0.7 },
    primaryButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
    pickerSheet: { backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 9, paddingHorizontal: 16, borderWidth: 1, borderColor: `${colors.bone}20` },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    modalTitle: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    modalSubTitle: { color: `${colors.bone}9C`, fontSize: 13, marginTop: 3 },
    modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    searchBox: { height: 46, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginBottom: 12 },
    searchInput: { flex: 1, height: 46, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    categoryRow: { gap: 8, paddingBottom: 13 },
    categoryChip: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}2B`, alignItems: "center", justifyContent: "center" },
    categoryChipActive: { backgroundColor: colors.success, borderColor: colors.success },
    categoryText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    categoryTextActive: { color: colors.successInk },
    pickerList: { paddingBottom: 18 },
    pickerRow: { gap: 10 },
    pickerCell: { flex: 1, marginBottom: 10 },
    emptyListText: { color: `${colors.bone}91`, textAlign: "center", fontSize: 14, lineHeight: 20, padding: 20 },
    noPieces: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 50, gap: 12 },
    retryButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface },
    retryText: { color: colors.success, fontSize: 13, fontWeight: "800" },
    linkSheet: { backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 9, paddingHorizontal: 18, borderWidth: 1, borderColor: `${colors.bone}20` },
    linkInputRow: { flexDirection: "row", alignItems: "center", minHeight: 52, backgroundColor: colors.surface, borderRadius: 16, paddingLeft: 14, paddingRight: 6, marginTop: 4 },
    linkInput: { flex: 1, minHeight: 52, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    findLinkButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    findLinkButtonDisabled: { opacity: 0.45 },
  });
}
