import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMarket, marketsIn, regions } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

const STORE_WELCOME_KEY = "uvel-store-welcome-seen-v1";
let storeWelcomeSeenThisSession = false;

export default function StorePicker() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { country, setCountry } = useUvel();
  const current = getMarket(country);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let active = true;
    if (storeWelcomeSeenThisSession) return () => { active = false; };
    void AsyncStorage.getItem(STORE_WELCOME_KEY)
      .then((seen) => {
        storeWelcomeSeenThisSession = true;
        if (seen !== "1" && active) setShowWelcome(true);
        if (seen !== "1") void AsyncStorage.setItem(STORE_WELCOME_KEY, "1");
      })
      .catch(() => {
        storeWelcomeSeenThisSession = true;
        if (active) setShowWelcome(true);
      });
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Store</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {showWelcome ? (
          <Text accessibilityRole="text" style={styles.lede}>
            Each country is its own Uvel. You’re on the {current.name} Shop — {current.currency}. A piece listed in
            another country never shows here unless that seller opens it to this Shop.
          </Text>
        ) : null}
        {regions().map((region) => (
          <View key={region}>
            <Text style={styles.region}>{region}</Text>
            {marketsIn(region).map((m) => {
              const on = m.code === current.code;
              return (
                <Pressable
                  key={m.code}
                  onPress={() => {
                    setCountry(m.code);
                    router.back();
                  }}
                  style={styles.row}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, on && styles.on]}>{m.name}</Text>
                    <Text style={styles.meta}>
                      {m.currency} · {m.symbol}
                    </Text>
                  </View>
                  {on ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 8,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    lede: { color: colors.muted, paddingHorizontal: 20, paddingBottom: 12, lineHeight: 21, fontSize: 15 },
    region: {
      color: colors.subtle,
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      paddingHorizontal: 20,
      marginTop: 22,
      marginBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(244,240,230,0.08)",
    },
    name: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    on: { color: "#D6E27A" },
    meta: { color: colors.muted, marginTop: 2, fontSize: 13 },
    check: { color: "#D6E27A", fontSize: 18, fontWeight: "700" },
  });
}
