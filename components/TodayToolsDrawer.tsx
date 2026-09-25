import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands } from "../lib/brands";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { useCopy } from "../lib/useCopy";

export type TodayToolsDrawerProps = { onClose: () => void; onOpenSell: () => void };

type Tool = {
  icon: keyof typeof Ionicons.glyphMap;
  menuIcon?: boolean;
  label: string;
  onPress: () => void;
};

export function TodayToolsDrawer({ onClose, onOpenSell }: TodayToolsDrawerProps) {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const C = useCopy();
  useBrands();
  const mine = ownedBrand(app.uid);
  const name = app.displayName || "Uvel member";
  const handle = app.username ? `@${app.username}` : "";
  const photo = app.avatarUri || app.personUri;
  const buildTools: Tool[] = [
    { icon: "color-palette-outline", label: "Founder Studio", onPress: () => router.push("/brand/founder") },
    { icon: "briefcase-outline" as const, label: "Brand HQ", onPress: () => router.push(mine ? { pathname: "/brand/hq", params: { id: mine.id } } : "/brand/hq") },
  ];
  const businessTools: Tool[] = [
    ...(!mine ? [{ icon: "stats-chart-outline" as const, label: "Your listings", onPress: () => router.push("/seller-analytics") }] : []),
    { icon: "add-circle-outline", label: "List an item", onPress: onOpenSell },
    { icon: "notifications-outline", label: "Price & restock alerts", onPress: () => router.push("/alerts") },
  ];
  const accountTools: Tool[] = [
    { icon: "help-circle-outline", label: C.helpSupport, onPress: () => router.push("/guide") },
    { icon: "settings-outline", menuIcon: true, label: C.settings, onPress: () => router.push("/settings") },
  ];

  return (
    <View style={[styles.page, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
      <Pressable
        onPress={() => {
          onClose();
          router.navigate("/you");
        }}
        style={styles.profile}
        accessibilityRole="button"
        accessibilityLabel={handle ? `${name}, ${handle}` : name}
      >
        {photo ? (
          <Image cachePolicy="memory-disk" source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInit}>{(name[0] || "U").toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {handle ? <Text style={styles.handle} numberOfLines={1}>{handle}</Text> : null}
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>BUILD</Text>
        {buildTools.map((tool) => <ToolRow key={tool.label} tool={tool} styles={styles} onClose={onClose} />)}
        <View style={styles.rule} />
        <Text style={styles.sectionLabel}>BUSINESS</Text>
        {businessTools.map((tool) => <ToolRow key={tool.label} tool={tool} styles={styles} onClose={onClose} />)}
        <View style={styles.rule} />
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {accountTools.map((tool) => <ToolRow key={tool.label} tool={tool} styles={styles} onClose={onClose} />)}
      </ScrollView>
      <Pressable
        onPress={() => Alert.alert(C.logOutTitle, C.logOutBody, [
          { text: C.cancel, style: "cancel" },
          { text: C.logOut, style: "destructive", onPress: () => { onClose(); void app.signOutAccount(); } },
        ])}
        style={({ pressed }) => [styles.signOutRow, pressed && { opacity: 0.72 }]}
        accessibilityRole="button"
        accessibilityLabel={C.logOut}
      >
        <Ionicons name="log-out-outline" size={22} color={styles.signOutLabel.color} />
        <Text style={styles.signOutLabel}>{C.logOut}</Text>
      </Pressable>
    </View>
  );
}

function ToolRow({ tool, styles, onClose }: { tool: Tool; styles: ReturnType<typeof make>; onClose: () => void }) {
  return (
    <Pressable
      onPress={() => {
        onClose();
        tool.onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]}
      accessibilityRole="button"
      accessibilityLabel={tool.label}
    >
      {tool.menuIcon ? <View style={styles.menuIcon} accessibilityElementsHidden><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View> : <Ionicons name={tool.icon} size={22} color={styles.label.color} />}
      <Text style={styles.label}>{tool.label}</Text>
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 18 },
    profile: { paddingBottom: 18, paddingTop: 8 },
    avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surface },
    avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    avatarInit: { color: colors.successInk, fontSize: 22, fontWeight: "800" },
    name: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 12 },
    handle: { color: `${colors.bone}7A`, fontSize: 14, marginTop: 3 },
    content: { paddingBottom: 20, paddingTop: 6 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}22`, marginVertical: 10, marginLeft: 2 },
    sectionLabel: { color: `${colors.bone}7A`, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginTop: 8, marginBottom: 2 },
    row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 16 },
    menuIcon: { width: 22, gap: 4 },
    menuLine: { height: 2, width: 22, borderRadius: 1, backgroundColor: colors.bone },
    label: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    signOutRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}22` },
    signOutLabel: { color: colors.bone, fontSize: 18, fontWeight: "700" },
  });
}

export default TodayToolsDrawer;
