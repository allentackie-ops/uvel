import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { useWardrobe } from "../lib/wardrobe";

export default function ActiveListings() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe().filter((piece) => piece.status === "listed" && piece.ownerId === app.uid);

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={30} color={colors.bone} />
        </Pressable>
        <Text style={styles.title}>Active listings</Text>
        <View style={styles.headerSpacer} />
      </View>
      {pieces.length ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {pieces.map((piece) => (
            <Pressable
              key={piece.id}
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id } })}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${piece.name}`}
              accessibilityHint="Double tap to view this listing."
            >
              <Image cachePolicy="memory-disk" source={{ uri: piece.photo }} style={styles.image} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active listings</Text>
        </View>
      )}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}1F`, alignItems: "center", justifyContent: "center" },
    headerSpacer: { width: 48, height: 48 },
    title: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    scroll: { flex: 1 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 4, paddingTop: 8 },
    tile: { width: "32.8%", aspectRatio: 1, backgroundColor: colors.surface, overflow: "hidden" },
    tilePressed: { opacity: 0.72 },
    image: { width: "100%", height: "100%" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: colors.muted, fontSize: 16 },
  });
}
