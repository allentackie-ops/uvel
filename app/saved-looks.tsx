import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";
import { removeSavedLook, savedLookImage, useSavedLooks, type SavedLook } from "../lib/savedLooks";
import { beginLookScan } from "../lib/lookSearch";

const GAP = 12;

export default function SavedLooks() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
    const looks = useSavedLooks();

  function scanLook(look: SavedLook) {
    beginLookScan({ title: look.title, imageUrl: look.imageUrl, time: 0 });
    router.push({ pathname: "/(tabs)/shop", params: { look: look.id, scan: "1" } });
  }

  function openSource(look: SavedLook) {
    if (look.postUrl) void Linking.openURL(look.postUrl);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.bone} />
        </Pressable>
        <View style={styles.headerCopy}>

          <Text style={styles.kicker}>YOUR COLLECTION</Text>
          <Text style={styles.title}>Saved Fits</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{looks.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 92, paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {looks.length ? (
          <>
            <Text style={styles.lede}>Your bookmarked looks, kept in one place.</Text>
            <View style={styles.grid}>
              {looks.map((look) => {
                const image = savedLookImage(look);
                return (
                  <View key={look.id} style={styles.card}>
                    <View style={styles.imageWrap}>
                      {image ? <Image source={image} style={styles.image} contentFit="cover" /> : <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>UVEL</Text></View>}
                      <AccessiblePressable
                        onPress={() => scanLook(look)}
                        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Search listings for ${look.title}`}
                        accessibilityHint="Double tap to find the clothes in this saved look."
                      >
                        <Ionicons name="search" size={19} color={colors.ink === "#000000" ? colors.ink : colors.successInk} />
                      </AccessiblePressable>
                      <AccessiblePressable
                        onPress={() => void removeSavedLook(look.id)}
                        style={({ pressed }) => [styles.bookmarkButton, pressed && { opacity: 0.8 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${look.title} from saved looks`}
                      >
                        <Ionicons name="bookmark" size={18} color={colors.successInk} />
                      </AccessiblePressable>
                    </View>
                    <View style={styles.cardMeta}>
                      <AccessiblePressable
                        onPress={() => openSource(look)}
                        disabled={!look.postUrl}
                        style={({ pressed }) => [styles.sourceRow, pressed && { opacity: 0.75 }]}
                        accessibilityRole={look.postUrl ? "link" : "text"}
                        accessibilityLabel={look.postUrl ? `Open original ${look.source} post` : `${look.source} source unavailable`}
                      >
                        <View style={styles.sourceDot} />
                        <Text style={styles.source} numberOfLines={1}>{look.source}</Text>
                        {look.postUrl ? <Ionicons name="open-outline" size={13} color={colors.bone} /> : null}
                      </AccessiblePressable>
                      <Text style={styles.cardTitle} numberOfLines={2}>{look.title}</Text>
                      <Text style={styles.savedAt}>Saved fit</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>⌑</Text></View>
            <Text style={styles.emptyTitle}>No saved fits yet</Text>
            <Text style={styles.emptyBody}>Tap the bookmark on any look in Today and it will appear here.</Text>
            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.emptyButton} accessibilityRole="button">
              <Text style={styles.emptyButtonText}>Explore Today</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  const darkMode = colors.ink === "#000000";
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.ink },
    header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, minHeight: 82, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", backgroundColor: `${colors.ink}F2` },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}30` },
    backGlyph: { color: colors.bone, fontSize: 32, lineHeight: 32, fontWeight: "300", marginTop: -3 },
    headerCopy: { flex: 1, alignItems: "center", marginLeft: 8 },
    kicker: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 27, marginTop: 3 },
    countPill: { minWidth: 40, height: 32, paddingHorizontal: 9, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    countText: { color: colors.successInk, fontSize: 13, fontWeight: "900" },
    content: { paddingHorizontal: 16 },
    lede: { color: `${colors.bone}9C`, fontSize: 14, lineHeight: 20, marginBottom: 16 },
    grid: { flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: 16 },
    card: { width: "48.2%", overflow: "hidden", borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}16` },
    imageWrap: { position: "relative" },
    image: { width: "100%", aspectRatio: 0.78, backgroundColor: colors.surface },
    actionButton: { position: "absolute", right: 10, bottom: 10, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: darkMode ? colors.bone : `${colors.surface}F5`, borderWidth: 1, borderColor: `${colors.ink}22`, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    bookmarkButton: { position: "absolute", left: 10, bottom: 10, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.bone, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    imageFallback: { width: "100%", aspectRatio: 0.78, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    imageFallbackText: { color: `${colors.bone}6B`, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
    cardMeta: { padding: 11 },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    source: { color: `${colors.bone}80`, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
    cardTitle: { color: colors.bone, fontSize: 14, lineHeight: 18, fontWeight: "700", marginTop: 7 },
    savedAt: { color: `${colors.bone}5C`, fontSize: 11, marginTop: 8 },
    empty: { marginTop: 80, padding: 24, borderRadius: 22, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}16` },
    emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    emptyGlyph: { color: colors.successInk, fontSize: 34, lineHeight: 36, fontWeight: "800" },
    emptyTitle: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 16 },
    emptyBody: { color: `${colors.bone}80`, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 280 },
    emptyButton: { marginTop: 20, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    emptyButtonText: { color: colors.successInk, fontWeight: "900", fontSize: 14 },
  });
}
