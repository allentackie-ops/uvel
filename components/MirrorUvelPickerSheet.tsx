import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "./ListingCard";
import { CATEGORIES } from "../lib/catalog";
import type { ClosetPiece } from "../lib/wardrobe";
import { useColors } from "../lib/theme";

export function MirrorUvelPickerSheet({
  open,
  pieces,
  query,
  category,
  marketplaceUnavailable,
  retryingMarketplace,
  onClose,
  onQueryChange,
  onCategoryChange,
  onPickPiece,
  onRetryMarketplace,
}: {
  open: boolean;
  pieces: ClosetPiece[];
  query: string;
  category: (typeof CATEGORIES)[number];
  marketplaceUnavailable: boolean;
  retryingMarketplace: boolean;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: (typeof CATEGORIES)[number]) => void;
  onPickPiece: (piece: ClosetPiece) => void;
  onRetryMarketplace: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dragY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const panStartScrollY = useSharedValue(0);
  const contentScrollGesture = useMemo(() => Gesture.Native(), []);
  const [contentHeight, setContentHeight] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchMode = searchFocused || query.trim().length > 0;
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

  const bottomPadding = Math.max(insets.bottom + 10, 16);
  const sheetChrome = 8 + bottomPadding;
  const sheetPaddingBottom = keyboardHeight ? 12 : bottomPadding;
  const maxSheetHeight = Math.max(220, windowHeight - keyboardHeight - insets.top - 10);
  const maxScrollHeight = Math.max(150, maxSheetHeight - sheetChrome);
  const fallbackScrollHeight = Math.min(maxScrollHeight, windowHeight * 0.48);
  const scrollHeight = Math.min(maxScrollHeight, contentHeight || fallbackScrollHeight);
  const sheetHeight = Math.min(maxSheetHeight, scrollHeight + 8 + sheetPaddingBottom);

  useEffect(() => {
    if (open) dragY.value = 0;
  }, [dragY, open]);
  useEffect(() => {
    setContentHeight(0);
  }, [category, query]);

  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      dragY.value = withSpring(0, { damping: 22, stiffness: 240, overshootClamping: true });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      dragY.value = withSpring(0, { damping: 22, stiffness: 240, overshootClamping: true });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [dragY, open]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));
  const dismissPan = useMemo(() => Gesture.Pan()
    .enabled(!searchMode)
    .activeOffsetY(6)
    .failOffsetX([-18, 18])
    .simultaneousWithExternalGesture(contentScrollGesture)
    .onBegin(() => {
      panStartScrollY.value = scrollY.value;
    })
    .onUpdate((event) => {
      if (panStartScrollY.value <= 1) dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (panStartScrollY.value <= 1 && (event.translationY > 72 || event.velocityY > 700)) {
        dragY.value = withTiming(sheetHeight, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        dragY.value = withSpring(0, { damping: 22, stiffness: 240, overshootClamping: true });
      }
    }), [contentScrollGesture, dragY, onClose, panStartScrollY, scrollY, searchMode, sheetHeight]);

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close Uvel picker" />
        <View pointerEvents="box-none" style={[styles.sheetWrap, { paddingBottom: keyboardHeight }]}>
          <GestureDetector gesture={dismissPan}>
            <Animated.View style={[styles.sheet, { height: sheetHeight, paddingBottom: sheetPaddingBottom }, sheetStyle]} accessibilityViewIsModal>
            <GestureDetector gesture={contentScrollGesture}>
              <Animated.ScrollView
                style={[styles.scroll, { height: scrollHeight, maxHeight: maxScrollHeight }]}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                onScroll={scrollHandler}
                onContentSizeChange={(_width, height) => setContentHeight((current) => Math.abs(current - height) > 1 ? height : current)}
              >
                <View style={styles.headingRow}>
                  <View>
                    <Text style={styles.title}>Choose a piece</Text>
                    <Text style={styles.subtitle}>Pick something from Uvel</Text>
                  </View>
                    <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close Uvel picker" accessibilityHint="Dismiss the From Uvel picker.">
                      <Ionicons name="chevron-down" size={18} color={colors.subtle} />
                    </Pressable>
                </View>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color={colors.subtle} />
                  <TextInput value={query} onChangeText={onQueryChange} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search pieces" placeholderTextColor={colors.subtle} style={styles.searchInput} returnKeyType="search" autoCorrect={false} accessibilityLabel="Search Uvel pieces" />
                  {query ? <Pressable onPress={() => onQueryChange("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}
                </View>
                <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} nativeID="uvel-picker-categories">
                  {CATEGORIES.map((value) => {
                    const active = value === category;
                    return <Pressable key={value} onPress={() => onCategoryChange(value)} style={[styles.category, active && styles.categoryActive]} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{value}</Text></Pressable>;
                  })}
                </Animated.ScrollView>
                {pieces.length ? (
                  <View style={styles.resultsBlock}>
                    {Array.from({ length: Math.ceil(visiblePieces.length / 2) }, (_, rowIndex) => {
                      const row = visiblePieces.slice(rowIndex * 2, rowIndex * 2 + 2);
                      return <View key={`uvel-row-${rowIndex}`} style={styles.row}>{row.map((piece) => <View key={piece.id} style={styles.cell}><ListingCard piece={piece} framed onOpen={() => onPickPiece(piece)} /></View>)}{row.length === 1 ? <View style={[styles.cell, styles.spacer]} /> : null}</View>;
                    })}
                    {!visiblePieces.length ? <Text style={styles.emptyText}>No pieces match that search.</Text> : null}
                  </View>
                ) : (
                  <View style={styles.emptyState}><Ionicons name="shirt-outline" size={28} color={colors.success} /><Text style={styles.emptyText}>No Uvel pieces are available right now.</Text>{marketplaceUnavailable ? <Pressable onPress={onRetryMarketplace} style={styles.retry} disabled={retryingMarketplace}><Text style={styles.retryText}>{retryingMarketplace ? "Reconnecting…" : "Retry connection"}</Text></Pressable> : null}</View>
                )}
              </Animated.ScrollView>
            </GestureDetector>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    sheetWrap: { width: "100%", justifyContent: "flex-end" },
    sheet: { width: "100%", backgroundColor: colors.ink, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderColor: `${colors.bone}22`, paddingTop: 8, paddingHorizontal: 16, overflow: "hidden" },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { paddingTop: 2, paddingBottom: 14 },
    headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    subtitle: { color: `${colors.bone}9C`, fontSize: 13, marginTop: 3 },
    searchBox: { height: 46, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginBottom: 10 },
    searchInput: { flex: 1, height: 46, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    categories: { gap: 8, paddingBottom: 10 },
    category: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}2B`, alignItems: "center", justifyContent: "center" },
    categoryActive: { backgroundColor: colors.success, borderColor: colors.success },
    categoryText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    categoryTextActive: { color: colors.successInk },
    resultsBlock: { paddingTop: 0 },
    row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    cell: { flex: 1, marginBottom: 10 },
    spacer: { opacity: 0 },
    emptyText: { color: `${colors.bone}91`, textAlign: "center", fontSize: 14, lineHeight: 20, padding: 20 },
    emptyState: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12 },
    retry: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface },
    retryText: { color: colors.success, fontSize: 13, fontWeight: "800" },
  });
}
