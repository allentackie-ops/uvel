import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "../../components/Sheet";
import { getBrand, updateBrand, useBrands } from "../../lib/brands";
import { recordAuditEvent } from "../../lib/audit";
import { importFounderWork, pickFromLibrary } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";

const OFFICES = [
  { id: "USPTO", title: "United States · USPTO", copy: "Official U.S. trademark filing", url: "https://trademarkcenter.uspto.gov/" },
  { id: "UKIPO", title: "United Kingdom · UKIPO", copy: "Official UK trade mark filing", url: "https://www.gov.uk/how-to-register-a-trade-mark" },
  { id: "EUIPO", title: "European Union · EUIPO", copy: "Official EU trade mark filing", url: "https://euipo.europa.eu/en/trade-marks" },
  { id: "WIPO", title: "International · WIPO", copy: "International route after a national or regional filing", url: "https://www.wipo.int/en/web/madrid-system" },
];

const statusText: Record<string, string> = {
  none: "Not started",
  filing: "In progress",
  in_progress: "In progress",
  submitted: "Submitted for review",
  filed: "Filed",
  registered: "Registered",
  needs_information: "More information needed",
};

export default function TrademarkPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const styles = useMemo(() => make(colors.ink === "#000000"), [colors.ink]);
  const owner = Boolean(brand && brand.ownerId === app.uid);
  const [ownerType, setOwnerType] = useState(brand?.trademarkOwnerType || "");
  const [markType, setMarkType] = useState(brand?.trademarkMarkType || "");
  const [office, setOffice] = useState(brand?.trademarkFilingOffice || "");
  const [applicationNumber, setApplicationNumber] = useState(brand?.trademarkApplicationNumber || "");
  const [filingDate, setFilingDate] = useState(brand?.trademarkFilingDate || "");
  const [documentUri, setDocumentUri] = useState(brand?.trademarkProofUri || "");
  const [documentName, setDocumentName] = useState(brand?.trademarkProofName || "");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = brand?.trademarkStatus || "none";

  async function chooseFile() {
    try {
      const picked = await importFounderWork();
      if (!picked) return;
      setDocumentUri(picked.uri);
      setDocumentName(picked.name);
    } catch (error) {
      Alert.alert("Could not attach file", error instanceof Error ? error.message : "Choose a PDF, image, or screenshot.");
    }
  }

  async function choosePhoto() {
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      setDocumentUri(uri);
      setDocumentName("Photo from camera roll");
    } catch (error) {
      Alert.alert("Could not choose photo", error instanceof Error ? error.message : "Allow Uvel to access your photos.");
    }
  }

  async function submitForReview() {
    if (!brand || !owner || busy) return;
    if (!ownerType || !markType || !office.trim() || !applicationNumber.trim() || !filingDate.trim() || !documentUri) {
      Alert.alert("Complete your trademark details", "Choose the owner and mark type, then add the filing office, application number, filing date, and a document or screenshot.");
      return;
    }
    setBusy(true);
    updateBrand(brand.id, {
      trademarkStatus: "submitted",
      trademarkOwnerType: ownerType as "individual" | "sole_proprietor" | "registered_business",
      trademarkMarkType: markType as "name" | "logo" | "name_and_logo",
      trademarkFilingOffice: office.trim(),
      trademarkApplicationNumber: applicationNumber.trim(),
      trademarkFilingDate: filingDate.trim(),
      trademarkProofUri: documentUri,
      trademarkProofName: documentName,
    });
    void recordAuditEvent({ brandId: brand.id, action: "trademark_submitted", entity: "brand", entityId: brand.id, entityName: brand.name, summary: "Trademark details submitted for Uvel review.", metadata: { office: office.trim(), markType } });
    setBusy(false);
    setShowReviewForm(false);
    Alert.alert("Submitted", "Your trademark details are under review.");
  }

  if (!brand) return <View style={[styles.page, { paddingTop: insets.top + 20 }]}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.h}>This brand isn’t here.</Text></View>;

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}><Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}><Text style={styles.navBack}>‹</Text></Pressable><Text style={styles.navTitle}>Trademark protection</Text><View style={{ width: 44 }} /></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>{brand.name}</Text>
        <View style={styles.optionalCard}><Text style={styles.optionalKicker}>OPTIONAL</Text><Text style={styles.optionalTitle}>Trademark protection is optional.</Text><Text style={styles.optionalCopy}>Start only when you need it.</Text></View>
        <Text style={styles.h}>Protect a name or logo</Text>
        <Text style={styles.p}>Use an official filing office. Uvel does not file or provide legal advice.</Text>
        <Text style={styles.sectionK}>OFFICIAL FILING OPTIONS</Text>
        <View style={styles.officeList}>{OFFICES.map((item) => <Pressable key={item.id} onPress={() => void Linking.openURL(item.url)} style={styles.officeRow}><View style={{ flex: 1 }}><Text style={styles.officeTitle}>{item.title}</Text><Text style={styles.officeCopy}>{item.copy}</Text></View><Text style={styles.officeAction}>Open ›</Text></Pressable>)}</View>
        <Pressable disabled={!owner} onPress={() => setShowReviewForm(true)} style={[styles.reviewRow, !owner && { opacity: 0.55 }]}><View style={{ flex: 1 }}><Text style={styles.reviewTitle}>Submit for review</Text><Text style={styles.reviewCopy}>{statusText[status]}{documentName ? ` · ${documentName}` : ""}</Text></View><Text style={styles.officeAction}>Open</Text></Pressable>
        <Sheet open={showReviewForm} onClose={() => setShowReviewForm(false)} expandable>
          <ScrollView style={styles.reviewSheetScroll} contentContainerStyle={styles.reviewSheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Submit trademark details</Text>
            <Text style={styles.sheetCopy}>Add the filing details and proof you want Uvel to review. Uvel does not file or provide legal advice.</Text>
            <Text style={styles.formK}>WHO OWNS THE TRADEMARK?</Text>
            <View style={styles.chips}>{[["individual", "Individual"], ["sole_proprietor", "Sole proprietor"], ["registered_business", "Registered business"]].map(([id, label]) => <Pressable key={id} onPress={() => setOwnerType(id)} style={[styles.chip, ownerType === id && styles.chipOn]}><Text style={[styles.chipText, ownerType === id && styles.chipTextOn]}>{label}</Text></Pressable>)}</View>
            <Text style={styles.formK}>WHAT ARE YOU PROTECTING?</Text>
            <View style={styles.chips}>{[["name", "Name"], ["logo", "Logo"], ["name_and_logo", "Name + logo"]].map(([id, label]) => <Pressable key={id} onPress={() => setMarkType(id)} style={[styles.chip, markType === id && styles.chipOn]}><Text style={[styles.chipText, markType === id && styles.chipTextOn]}>{label}</Text></Pressable>)}</View>
            <TextInput value={office} onChangeText={setOffice} placeholder="Filing office or country" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={applicationNumber} onChangeText={setApplicationNumber} placeholder="Application or registration number" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput value={filingDate} onChangeText={setFilingDate} placeholder="Filing date · YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} />
            <View style={styles.attachmentActions}><Pressable onPress={() => void chooseFile()} style={styles.attachmentButton}><Text style={styles.attachmentText}>Attach PDF or file</Text></Pressable><Pressable onPress={() => void choosePhoto()} style={styles.attachmentButton}><Text style={styles.attachmentText}>Choose photo</Text></Pressable></View>
            {documentName ? <View style={styles.documentRow}><Text style={styles.documentName} numberOfLines={1}>{documentName}</Text><Pressable onPress={() => { setDocumentUri(""); setDocumentName(""); }}><Text style={styles.remove}>Remove</Text></Pressable></View> : null}
            <Text style={styles.formHint}>Uvel will review the submitted details before showing Registered.</Text>
            <View style={styles.reviewSheetActions}>
              <Pressable onPress={() => setShowReviewForm(false)} style={[styles.actionButton, styles.reviewSheetActionButton]} accessibilityRole="button"><Text style={styles.actionButtonTxt}>Cancel</Text></Pressable>
              <Pressable disabled={busy} onPress={() => void submitForReview()} style={[styles.submit, styles.reviewSheetActionButton, busy && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.submitText}>{busy ? "Submitting…" : "Submit for review"}</Text></Pressable>
            </View>
          </ScrollView>
        </Sheet>
      </ScrollView>
    </View>
  );
}

function make(dark: boolean) {
  const ink = dark ? "#F4F0E6" : "#16140F";
  const muted = dark ? "rgba(244,240,230,0.55)" : "rgba(22,20,15,0.5)";
  const line = dark ? "rgba(244,240,230,0.12)" : "rgba(22,20,15,0.1)";
  const card = dark ? "#1C1A16" : "#F6F1E6";
  const accent = dark ? "#D6E27A" : "#8A9600";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: dark ? "#0E0D0B" : "#FFFFFF" },
    nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 48 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: ink, fontSize: 32, lineHeight: 34, marginTop: -4 },
    navTitle: { flex: 1, textAlign: "center", color: ink, fontSize: 16, fontWeight: "700" },
    back: { color: ink, fontSize: 16, fontWeight: "700", paddingHorizontal: 22 },
    brand: { color: muted, fontSize: 13, fontWeight: "700", marginTop: 18, letterSpacing: 0.4 },
    h: { color: ink, fontSize: 28, fontWeight: "800", marginTop: 20 },
    p: { color: muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
    optionalCard: { borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: line, padding: 16, marginTop: 18 },
    optionalKicker: { color: accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
    optionalTitle: { color: ink, fontSize: 16, fontWeight: "900", marginTop: 6 },
    optionalCopy: { color: muted, fontSize: 13, marginTop: 4 },
    sectionK: { color: muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.3, marginTop: 24, marginBottom: 8 },
    officeList: { borderWidth: 1, borderColor: line, borderRadius: 17, paddingHorizontal: 13, backgroundColor: card },
    officeRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line, flexDirection: "row", alignItems: "center", gap: 12 },
    officeTitle: { color: ink, fontSize: 14, fontWeight: "900" },
    officeCopy: { color: muted, fontSize: 12, marginTop: 3 },
    officeAction: { color: accent, fontSize: 12, fontWeight: "900" },
    reviewRow: { borderWidth: 1, borderColor: line, borderRadius: 17, backgroundColor: card, padding: 14, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 },
    reviewTitle: { color: ink, fontSize: 15, fontWeight: "900" },
    reviewCopy: { color: muted, fontSize: 12, marginTop: 4 },
    form: { borderWidth: 1, borderColor: line, borderRadius: 17, backgroundColor: card, padding: 14, marginTop: 8 },
    formK: { color: muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 5, marginBottom: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 13 },
    chip: { borderWidth: 1, borderColor: line, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 9 },
    chipOn: { borderColor: accent, backgroundColor: dark ? "rgba(214,226,122,0.14)" : "rgba(138,150,0,0.1)" },
    chipText: { color: muted, fontSize: 12, fontWeight: "700" },
    chipTextOn: { color: ink },
    input: { height: 46, borderWidth: 1, borderColor: line, borderRadius: 13, paddingHorizontal: 12, color: ink, fontSize: 14, marginTop: 9 },
    attachmentActions: { flexDirection: "row", gap: 8, marginTop: 10 },
    attachmentButton: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: line, borderRadius: 13, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
    attachmentText: { color: ink, fontSize: 12, fontWeight: "800", textAlign: "center" },
    documentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 },
    documentName: { color: ink, fontSize: 12, fontWeight: "800", flex: 1 },
    remove: { color: muted, fontSize: 11, textDecorationLine: "underline" },
    formHint: { color: muted, fontSize: 12, lineHeight: 17, marginTop: 12 },
    submit: { minHeight: 48, borderRadius: 15, backgroundColor: accent, alignItems: "center", justifyContent: "center", marginTop: 14 },
    submitText: { color: dark ? "#16140F" : "#FFFFFF", fontSize: 14, fontWeight: "900" },
    reviewSheetScroll: { flex: 1 },
    reviewSheetContent: { paddingBottom: 12 },
    sheetTitle: { color: ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
    sheetCopy: { color: muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 4 },
    actionButton: { height: 48, borderWidth: 1, borderColor: line, borderRadius: 15, paddingHorizontal: 16, justifyContent: "center" },
    actionButtonTxt: { color: ink, fontSize: 13, fontWeight: "900" },
    reviewSheetActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingTop: 16, paddingBottom: 8 },
    reviewSheetActionButton: { marginTop: 0 },
  });
}
