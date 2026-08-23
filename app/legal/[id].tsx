import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCS } from "../../lib/legal";
import { useColors, type Colors } from "../../lib/theme";

export default function Legal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = DOCS[id ?? ""] ?? DOCS.privacy;
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerTitle: doc.title, headerTransparent: false, headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>Last updated {doc.updated}</Text>
        {doc.sections.map((s) => (
          <View key={s.heading} style={styles.block}>
            <Text style={styles.h}>{s.heading}</Text>
            {s.body.map((p) => (
              <Text key={p} style={styles.p}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    meta: { color: colors.subtle, fontSize: 12, marginBottom: 22 },
    block: { marginBottom: 22 },
    h: { color: colors.bone, fontSize: 17, fontWeight: "600", marginBottom: 8 },
    p: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  });
}
