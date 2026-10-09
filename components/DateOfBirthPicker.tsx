import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../lib/theme";

type Props = {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
};

type WheelProps = {
  label: string;
  values: Array<number | string>;
  selectedIndex: number;
  onChange: (index: number) => void;
  textColor: string;
  mutedColor: string;
  highlightColor: string;
};

const MIN_YEAR = 1920;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ROW_HEIGHT = 48;

function latestEligibleDate() {
  const today = new Date();
  const year = today.getFullYear() - 18;
  const month = today.getMonth();
  const day = Math.min(today.getDate(), new Date(year, month + 1, 0).getDate());
  return new Date(year, month, day);
}

function fromIso(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Choose a day";
}

function clampDate(date: Date, maxDate: Date) {
  const year = Math.max(MIN_YEAR, Math.min(date.getFullYear(), maxDate.getFullYear()));
  const maxMonth = year === maxDate.getFullYear() ? maxDate.getMonth() : 11;
  const month = Math.min(date.getMonth(), maxMonth);
  const maxDay = year === maxDate.getFullYear() && month === maxDate.getMonth()
    ? maxDate.getDate()
    : new Date(year, month + 1, 0).getDate();
  const day = Math.min(date.getDate(), maxDay);
  return new Date(year, month, day);
}

function Wheel({ label, values, selectedIndex, onChange, textColor, mutedColor, highlightColor }: WheelProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ROW_HEIGHT, animated: false });
  }, [selectedIndex, values.length]);

  return (
    <View style={styles.wheel} accessibilityLabel={label}>
      <View pointerEvents="none" style={[styles.selectionBand, { backgroundColor: highlightColor }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={styles.wheelContent}
        onMomentumScrollEnd={(event) => {
          const index = Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT)));
          onChange(index);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, ${String(values[selectedIndex])}`}
      >
        {values.map((value, index) => {
          const distance = Math.abs(index - selectedIndex);
          return (
            <Pressable key={`${label}-${value}`} onPress={() => onChange(index)} style={styles.wheelRow}>
              <Text style={[styles.wheelText, { color: distance === 0 ? textColor : mutedColor, opacity: distance > 1 ? 0.42 : distance === 1 ? 0.7 : 1 }]}>
                {value}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DateOfBirthPicker({ visible, value, onClose, onSelect }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const maxDate = useMemo(latestEligibleDate, []);
  const [draftDate, setDraftDate] = useState<Date | null>(() => fromIso(value));

  useEffect(() => {
    if (!visible) return;
    const selected = fromIso(value);
    setDraftDate(selected ? clampDate(selected, maxDate) : null);
  }, [visible, value, maxDate]);

  const fallbackDate = draftDate ?? maxDate;
  const years = useMemo(() => Array.from({ length: maxDate.getFullYear() - MIN_YEAR + 1 }, (_, index) => maxDate.getFullYear() - index), [maxDate]);
  const daysInMonth = new Date(fallbackDate.getFullYear(), fallbackDate.getMonth() + 1, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, index) => index + 1), [daysInMonth]);
  const yearIndex = years.indexOf(fallbackDate.getFullYear());
  const monthIndex = fallbackDate.getMonth();
  const dayIndex = Math.min(fallbackDate.getDate() - 1, days.length - 1);
  const surface = Platform.OS === "ios" ? colors.ink : colors.surface;
  const sheet = Platform.OS === "ios" ? colors.surface : colors.ink;
  const highlight = Platform.OS === "ios" ? colors.subtle : colors.surface;

  function updateDate(part: "year" | "month" | "day", index: number) {
    const nextYear = part === "year" ? years[index] : fallbackDate.getFullYear();
    const nextMonth = part === "month" ? index : fallbackDate.getMonth();
    const nextDay = part === "day" ? index + 1 : fallbackDate.getDate();
    setDraftDate(clampDate(new Date(nextYear, nextMonth, nextDay), maxDate));
  }

  const stylesForColors = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[stylesForColors.backdrop, { backgroundColor: "rgba(0, 0, 0, 0.56)" }]}>
        <View style={[stylesForColors.sheet, { backgroundColor: sheet, paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={stylesForColors.handle} />
          <View style={stylesForColors.header}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel date of birth">
              <Text style={[stylesForColors.headerAction, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
            <Text style={[stylesForColors.title, { color: colors.bone }]}>Date of birth</Text>
            <Pressable
              onPress={() => {
                if (draftDate) {
                  onSelect(toIso(draftDate));
                  onClose();
                }
              }}
              disabled={!draftDate}
              accessibilityRole="button"
              accessibilityLabel="Save date of birth"
            >
              <Text style={[stylesForColors.headerAction, { color: draftDate ? (colors.link || colors.pulse) : colors.subtle, fontWeight: "700" }]}>Done</Text>
            </Pressable>
          </View>

          <View style={[stylesForColors.wheels, { backgroundColor: surface }]}>
            <Wheel label="Day" values={days} selectedIndex={dayIndex} onChange={(index) => updateDate("day", index)} textColor={colors.bone} mutedColor={colors.muted} highlightColor={highlight} />
            <Wheel label="Month" values={MONTHS} selectedIndex={monthIndex} onChange={(index) => updateDate("month", index)} textColor={colors.bone} mutedColor={colors.muted} highlightColor={highlight} />
            <Wheel label="Year" values={years} selectedIndex={yearIndex} onChange={(index) => updateDate("year", index)} textColor={colors.bone} mutedColor={colors.muted} highlightColor={highlight} />
          </View>

          <View style={stylesForColors.summary}>
            <Ionicons name="calendar-outline" size={18} color={colors.link || colors.pulse} />
            <Text style={[stylesForColors.summaryText, { color: colors.bone }]}>{draftDate ? formatDate(draftDate) : "Choose your birthday"}</Text>
          </View>
          <Text style={[stylesForColors.note, { color: colors.muted }]}>You must be 18 or older to create an account.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wheel: { flex: 1, height: ROW_HEIGHT * 3, overflow: "hidden", position: "relative" },
  wheelContent: { paddingVertical: ROW_HEIGHT },
  wheelRow: { height: ROW_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  wheelText: { fontSize: 22, fontWeight: "500" },
  selectionBand: { position: "absolute", zIndex: 1, left: 0, right: 0, top: ROW_HEIGHT, height: ROW_HEIGHT, borderRadius: 12 },
});

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10 },
    handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.subtle, marginBottom: 12 },
    header: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerAction: { fontSize: 16, minWidth: 54 },
    title: { fontSize: 17, fontWeight: "700" },
    wheels: { flexDirection: "row", borderRadius: 16, overflow: "hidden", marginTop: 7 },
    summary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
    summaryText: { fontSize: 16, fontWeight: "600" },
    note: { textAlign: "center", fontSize: 12, lineHeight: 17, marginTop: 8 },
  });
}
