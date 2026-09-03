import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getMarket, marketsIn, regions } from "../lib/markets";
import { encodeShipsTo, shipsMode, shipsToLabel, type ShipsTo } from "../lib/ships";
import { alpha, useColors, type Colors } from "../lib/theme";

type Mode = "home" | "all" | "pick";

export function ShipsPicker({
  origin,
  value,
  onChange,
}: {
  origin: string;
  value: ShipsTo;
  onChange: (next: ShipsTo) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const home = getMarket(origin);
  const [mode, setMode] = useState<Mode>(() => shipsMode(origin, value));
  const picked = Array.isArray(value) ? value.map((c) => c.toUpperCase()) : [];
  const [open, setOpen] = useState(() => shipsMode(origin, value) === "pick");

  function choose(next: Mode) {
    setMode(next);
    if (next === "pick") {
      setOpen(true);
      onChange(encodeShipsTo(origin, "pick", picked.length ? picked : [origin]));
      return;
    }
    setOpen(false);
    onChange(encodeShipsTo(origin, next));
  }

  function toggle(code: string) {
    if (code.toUpperCase() === origin.toUpperCase()) return;
    const on = picked.includes(code.toUpperCase());
    const next = on ? picked.filter((c) => c !== code.toUpperCase()) : [...picked, code.toUpperCase()];
    onChange(encodeShipsTo(origin, "pick", next));
  }

  return (
    <View>
      <Text style={styles.label}>Where it sells</Text>
      <Text style={styles.lede}>
        Each country is its own Uvel. This listing goes on the {home.name} floor. Buyers in other countries will not
        see it unless you allow it.
      </Text>

      <Choice
        styles={styles}
        on={mode === "home"}
        title={`${home.name} only`}
        body={`Default. Buyers in other stores never see it.`}
        onPress={() => choose("home")}
      />
      <Choice
        styles={styles}
        on={mode === "all"}
        title="Every Uvel store"
        body="You ship worldwide. Every country’s floor can show this piece."
        onPress={() => choose("all")}
      />
      <Choice
        styles={styles}
        on={mode === "pick"}
        title="Choose countries"
        body={mode === "pick" ? shipsToLabel(origin, value) : "Open extra floors yourself. Home stays on."}
        onPress={() => choose("pick")}
      />

      {open ? (
        <View style={styles.pick}>
          {regions().map((region) => (
            <View key={region}>
              <Text style={styles.region}>{region}</Text>
              {marketsIn(region).map((m) => {
                const locked = m.code === home.code;
                const on = locked || picked.includes(m.code);
                return (
                  <Pressable
                    key={m.code}
                    onPress={() => toggle(m.code)}
                    disabled={locked}
                    style={styles.row}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, on && styles.rowOn]}>{m.name}</Text>
                      <Text style={styles.rowMeta}>
                        {m.currency}
                        {locked ? " · this listing’s floor" : ""}
                      </Text>
                    </View>
                    <View style={[styles.box, on && styles.boxOn]}>
                      {on ? <Text style={styles.tick}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Choice({
  styles,
  on,
  title,
  body,
  onPress,
}: {
  styles: ReturnType<typeof make>;
  on: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.choiceT}>{title}</Text>
        <Text style={styles.choiceB}>{body}</Text>
      </View>
      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    label: { color: colors.subtle, fontSize: 12, letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
    lede: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    choice: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.subtle + "40",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
      backgroundColor: colors.surface,
    },
    choiceOn: { borderColor: "#D6E27A", backgroundColor: "rgba(214,226,122,0.1)" },
    choiceT: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    choiceB: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: alpha(colors.legacyText, 0.28),
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { borderColor: "#D6E27A" },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#D6E27A" },
    pick: { marginTop: 6, marginBottom: 8 },
    region: {
      color: colors.subtle,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      marginTop: 14,
      marginBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: alpha(colors.legacyText, 0.08),
    },
    rowName: { color: colors.bone, fontSize: 15, fontWeight: "600" },
    rowOn: { color: "#D6E27A" },
    rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: alpha(colors.legacyText, 0.28),
      alignItems: "center",
      justifyContent: "center",
    },
    boxOn: { backgroundColor: "#D6E27A", borderColor: "#D6E27A" },
    tick: { color: colors.legacyInk, fontSize: 13, fontWeight: "800" },
  });
}
