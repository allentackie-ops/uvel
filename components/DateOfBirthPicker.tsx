import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../lib/theme";

type Props = {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
};

type MonthView = { year: number; month: number };

const MIN_YEAR = 1920;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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

export function DateOfBirthPicker({ visible, value, onClose, onSelect }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const accent = colors.link || colors.pulse;
  const maxDate = useMemo(latestEligibleDate, []);
  const [view, setView] = useState<MonthView>(() => {
    const initial = fromIso(value) ?? maxDate;
    return { year: initial.getFullYear(), month: initial.getMonth() };
  });
  const [draftDate, setDraftDate] = useState<Date | null>(() => fromIso(value));
  const [choosingYear, setChoosingYear] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const selected = fromIso(value);
    const initial = selected ?? maxDate;
    setView({ year: initial.getFullYear(), month: initial.getMonth() });
    setDraftDate(selected);
    setChoosingYear(false);
  }, [visible, value, maxDate]);

  const minDate = useMemo(() => new Date(MIN_YEAR, 0, 1), []);
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const weekCount = Math.ceil((firstDay + daysInMonth) / 7);
  const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const previousMonth = new Date(view.year, view.month - 1, 1);
  const nextMonth = new Date(view.year, view.month + 1, 1);
  const canGoBack = previousMonth >= new Date(MIN_YEAR, 0, 1);
  const canGoForward = nextMonth <= maxMonth;
  const yearOptions = useMemo(
    () => Array.from({ length: maxDate.getFullYear() - MIN_YEAR + 1 }, (_, index) => maxDate.getFullYear() - index),
    [maxDate],
  );

  function changeMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  function chooseYear(year: number) {
    setView((current) => ({ year, month: Math.min(current.month, year === maxDate.getFullYear() ? maxDate.getMonth() : 11) }));
    setChoosingYear(false);
  }

  function pickDay(day: number) {
    const next = new Date(view.year, view.month, day);
    if (next < minDate || next > maxDate) return;
    setDraftDate(next);
  }

  const styles = make(colors);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: colors.ink, paddingTop: Math.max(insets.top, 12) }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.subtle }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close date picker" style={[styles.closeButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="close" size={21} color={colors.bone} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.bone }]}>Date of birth</Text>
          <View style={styles.closeSpacer} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: colors.muted }]}>Choose your birthday. Tap the month and year to jump straight to your birth year.</Text>

          <View style={[styles.calendar, { backgroundColor: colors.surface, borderColor: colors.subtle }]}>
            <View style={styles.monthBar}>
              <Pressable
                onPress={() => changeMonth(-1)}
                disabled={!canGoBack || choosingYear}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-back" size={21} color={canGoBack && !choosingYear ? colors.bone : colors.subtle} />
              </Pressable>
              <Pressable
                onPress={() => setChoosingYear((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={choosingYear ? "Return to calendar" : "Choose birth year"}
                style={styles.monthLabel}
              >
                <Text style={[styles.monthText, { color: colors.bone }]}>{MONTHS[view.month]} {view.year}</Text>
                <Ionicons name={choosingYear ? "chevron-up" : "chevron-down"} size={16} color={accent} />
              </Pressable>
              <Pressable
                onPress={() => changeMonth(1)}
                disabled={!canGoForward || choosingYear}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-forward" size={21} color={canGoForward && !choosingYear ? colors.bone : colors.subtle} />
              </Pressable>
            </View>

            {choosingYear ? (
              <ScrollView nestedScrollEnabled style={styles.yearScroll} contentContainerStyle={styles.yearGrid} showsVerticalScrollIndicator={false}>
                {yearOptions.map((year) => (
                  <Pressable
                    key={year}
                    onPress={() => chooseYear(year)}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${year}`}
                    accessibilityState={{ selected: view.year === year }}
                    style={[styles.yearOption, year === view.year && { backgroundColor: accent }]}
                  >
                    <Text style={[styles.yearText, { color: year === view.year ? colors.ink : colors.bone }]}>{year}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                <View style={styles.dayRow}>
                  {WEEKDAYS.map((day, index) => (
                    <View key={`${day}-${index}`} style={styles.dayCell}>
                      <Text style={[styles.weekday, { color: colors.muted }]}>{day}</Text>
                    </View>
                  ))}
                </View>
                {Array.from({ length: weekCount }, (_, week) => (
                  <View key={`week-${week}`} style={styles.dayRow}>
                    {Array.from({ length: 7 }, (_, column) => {
                      const day = week * 7 + column - firstDay + 1;
                      if (day < 1 || day > daysInMonth) return <View key={`empty-${column}`} style={styles.dayCell} />;
                      const date = new Date(view.year, view.month, day);
                      const disabled = date < minDate || date > maxDate;
                      const selected = Boolean(draftDate && toIso(draftDate) === toIso(date));
                      return (
                        <Pressable
                          key={day}
                          onPress={() => pickDay(day)}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                          accessibilityState={{ disabled, selected }}
                          style={[styles.dayCell, styles.dayButton, selected && { backgroundColor: accent }, disabled && styles.disabledDay]}
                        >
                          <Text style={[styles.dayText, { color: selected ? colors.ink : disabled ? colors.subtle : colors.bone }]}>{day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={[styles.selectedCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="calendar-outline" size={20} color={accent} />
            <View style={styles.selectedCopy}>
              <Text style={[styles.selectedLabel, { color: colors.muted }]}>Selected date</Text>
              <Text style={[styles.selectedDate, { color: colors.bone }]}>{formatDate(draftDate)}</Text>
            </View>
          </View>
          <Text style={[styles.ageNote, { color: colors.muted }]}>You must be 18 or older to create an account.</Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Pressable
            onPress={() => {
              if (!draftDate) return;
              onSelect(toIso(draftDate));
              onClose();
            }}
            disabled={!draftDate}
            accessibilityRole="button"
            accessibilityState={{ disabled: !draftDate }}
            style={[styles.confirmButton, { backgroundColor: draftDate ? accent : colors.subtle }, !draftDate && styles.disabledButton]}
          >
            <Text style={[styles.confirmText, { color: draftDate ? colors.ink : colors.muted }]}>Use this date</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1 },
    topBar: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
    closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    closeSpacer: { width: 42, height: 42 },
    topTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
    content: { flex: 1 },
    contentInner: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16 },
    intro: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
    calendar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 10, paddingBottom: 8, overflow: "hidden" },
    monthBar: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthArrow: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    monthLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, paddingHorizontal: 8 },
    monthText: { fontSize: 16, fontWeight: "700" },
    yearScroll: { height: 294 },
    yearGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 6 },
    yearOption: { width: "25%", minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
    yearText: { fontSize: 15, fontWeight: "600" },
    dayRow: { flexDirection: "row", justifyContent: "space-between" },
    dayCell: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", marginVertical: 1 },
    weekday: { fontSize: 12, fontWeight: "600" },
    dayButton: { borderRadius: 21 },
    dayText: { fontSize: 14, fontWeight: "500" },
    disabledDay: { opacity: 0.62 },
    selectedCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginTop: 18 },
    selectedCopy: { flex: 1 },
    selectedLabel: { fontSize: 12, lineHeight: 16 },
    selectedDate: { fontSize: 16, fontWeight: "600", marginTop: 3 },
    ageNote: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 14 },
    footer: { paddingHorizontal: 22, paddingTop: 12, alignItems: "center" },
    confirmButton: { minHeight: 56, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRadius: 28 },
    confirmText: { fontSize: 16, fontWeight: "700" },
    cancelButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, marginTop: 4 },
    cancelText: { fontSize: 14, fontWeight: "600" },
    disabledButton: { opacity: 0.7 },
  });
}
