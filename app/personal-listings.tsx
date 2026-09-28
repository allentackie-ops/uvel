import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../components/ListingCard";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { usePersonalization } from "../lib/personalization";
import { getPiece, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

type PersonalKind = "saved" | "recent" | "wardrobe";

const COPY: Record<PersonalKind, { title: string; body: string; emptyTitle: string; emptyBody: string }> = {
  saved: {
    title: "Saved listings",
    body: "Pieces you want to come back to.",
    emptyTitle: "Nothing saved yet",
    emptyBody: "Tap the heart on a listing to keep it here.",
  },
  recent: {
    title: "Recently viewed",
    body: "Listings you opened recently.",
    emptyTitle: "Nothing here yet",
    emptyBody: "Listings you open will appear here so you can find them again.",
  },
  wardrobe: {
    title: "My wardrobe",
    body: "Your clothing and listings in one place.",
    emptyTitle: "Your wardrobe is empty",
    emptyBody: "Add a piece from Create to start building your wardrobe.",
  },
};

export default function PersonalListings() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const personalization = usePersonalization(app.uid);
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: PersonalKind = params.kind === "recent" || params.kind === "wardrobe" ? params.kind : "saved";
  const copy = COPY[kind];

  const listings = useMemo(() => {
    if (kind === "saved") {
      const byId = new Map(pieces.map((piece) => [piece.id, piece]));
      return app.saved.map((id) => byId.get(id) || getPiece(id)).filter(Boolean) as ClosetPiece[];
    }
    if (kind === "wardrobe") {
      return pieces.filter((piece) => piece.ownerId === app.uid && piece.status !== "draft" && piece.status !== "archived");
    }
    const viewed = Object.entries(personalization.profile.listings)
      .filter(([, signal]) => signal.lastViewedAt > 0)
      .sort(([, a], [, b]) => b.lastViewedAt - a.lastViewedAt)
      .map(([id]) => pieces.find((piece) => piece.id === id) || getPiece(id))
      .filter(Boolean) as ClosetPiece[];
    return viewed;
  }, [app.saved, app.uid, kind, personalization.profile.listings, pieces]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.kicker}>TODAY</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
        {listings.length ? (
          <View style={styles.grid}>
            {listings.map((piece) => <View key={piece.id} style={styles.cell}><ListingCard piece={piece} framed /></View>)}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 16 },
    topBar: { marginBottom: 22 },
    kicker: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 2.1 },
    title: { color: colors.bone, fontSize: 32, lineHeight: 38, fontWeight: "800", marginTop: 6 },
    body: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "48%", flexGrow: 1, maxWidth: "48.5%" },
    empty: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 34, marginTop: 12 },
    emptyTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", textAlign: "center" },
    emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 7 },
  });
}
