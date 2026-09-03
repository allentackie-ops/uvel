import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerifiedMark } from "../../components/VerifiedMark";
import { VERTICALS } from "../../lib/brandSizes";
import { brandContactHint, hasBrandContact } from "../../lib/brandContact";
import { createBrand, handleFree, ownedBrand, submitForVerification, updateBrand, useBrands } from "../../lib/brands";
import { VERIFY_STAGES } from "../../lib/brandVerify";
import { pickLogo, takeLogo } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { OrbitLoader } from "../../components/OrbitLoader";

type Gate = { phase: "idle" } | { phase: "review" } | { phase: "block"; decision: "needs_information" | "human_review" | "rejected"; headline: string; reasons: string[] } | { phase: "pass" };

export default function BrandApply() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const mine = ownedBrand(app.uid);
  const ph = "rgba(244,240,230,0.32)";

  const [name, setName] = useState(mine?.name ?? "");
  const [handle, setHandle] = useState(mine?.handle ?? "");
  const [vertical, setVertical] = useState(mine?.vertical ?? "Unisex");
  const [legalName, setLegalName] = useState(mine?.legalName ?? "");
  const [registrationId, setRegistrationId] = useState(mine?.registrationId ?? "");
  const [website, setWebsite] = useState(mine?.website ?? "");
  const [instagram, setInstagram] = useState(mine?.instagram ?? "");
  const [phone, setPhone] = useState(mine?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(mine?.whatsapp ?? "");
  const [contactEmail, setContactEmail] = useState(mine?.contactEmail ?? "");
  const [story, setStory] = useState(mine?.story ?? "");
  const [tagline, setTagline] = useState(mine?.tagline ?? "");
  const [logoUri, setLogoUri] = useState(mine?.logoUri ?? "");
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (gate.phase !== "review") return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % VERIFY_STAGES.length), 4200);
    return () => clearInterval(t);
  }, [gate.phase]);

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(handle.trim()) &&
    Boolean(story.trim()) &&
    hasBrandContact({ phone, whatsapp, instagram, contactEmail, website }) &&
    Boolean(legalName.trim()) &&
    Boolean(logoUri) &&
    gate.phase === "idle";

  async function chooseLogo() {
    Alert.alert("Brand mark", "A square logo. Buyers see this next to the blue check.", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => void takeLogo().then((u) => u && setLogoUri(u)) },
      { text: "Choose photo", onPress: () => void pickLogo().then((u) => u && setLogoUri(u)) },
    ]);
  }

  async function submit() {
    if (!canSubmit) return;
    if (!app.uid) {
      Alert.alert("Sign in", "Open a brand from the account that will own it.");
      return;
    }
    const h = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!handleFree(h, mine?.id)) {
      Alert.alert("Handle taken", "That @ is already on a brand.");
      return;
    }
    setGate({ phase: "review" });
    const started = Date.now();
    let brand = mine;
    try {
      if (!brand) {
        brand = await createBrand({
          name: name.trim(),
          handle: h,
          tagline: tagline.trim(),
          story: story.trim(),
          vertical,
          website: website.trim(),
          instagram,
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          legalName: legalName.trim(),
          registrationId: registrationId.trim(),
          contactEmail: contactEmail.trim(),
          country: app.country,
          logoUri,
          ownerId: app.uid,
          ownerName: app.displayName || "Owner",
          ownerPhoto: app.avatarUri || app.personUri || undefined,
        });
      } else {
        updateBrand(brand.id, {
          name: name.trim(),
          handle: h,
          tagline: tagline.trim(),
          story: story.trim(),
          vertical,
          website: website.trim(),
          instagram: instagram.replace(/^@/, "").trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          legalName: legalName.trim(),
          registrationId: registrationId.trim(),
          contactEmail: contactEmail.trim(),
          logoUri,
        });
      }
      const result = await submitForVerification(brand.id, {
        name: name.trim(),
        handle: h,
        legalName: legalName.trim(),
        vertical,
        story: story.trim(),
        website: website.trim(),
        instagram: instagram.replace(/^@/, "").trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        contactEmail: contactEmail.trim(),
        country: app.country,
        registrationId: "",
        ownerName: app.displayName || "Owner",
        ownerEmail: contactEmail.trim(),
      });
      const wait = Math.max(0, 18000 - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      if (!result.ok) {
        setGate({ phase: "block", decision: result.decision === "needs_information" || result.decision === "rejected" ? result.decision : "human_review", headline: result.headline, reasons: result.reasons });
        return;
      }
      setGate({ phase: "pass" });
      setTimeout(() => router.replace({ pathname: "/brand/[id]", params: { id: brand!.id } }), 1200);
    } catch (err) {
      setGate({
        phase: "block",
        decision: "human_review",
        headline: "Human review is needed",
        reasons: [err instanceof Error ? err.message : "Try again in a moment."],
      });
    }
  }

  if (mine?.verified) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.done}>
          <VerifiedMark size={28} />
          <Text style={styles.doneH}>{mine.name} is verified</Text>
          <Text style={styles.doneP}>You own this house. Post, invite the team, and dress the page.</Text>
          <Pressable onPress={() => router.replace({ pathname: "/brand/[id]", params: { id: mine.id } })} style={styles.doneCta}>
            <Text style={styles.ctaTxt}>Open brand page</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Open a brand</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 240, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
          <Text style={styles.lede}>
            Brands are not personal closets. We check the required fields for a real fashion house — Instagram, site, and tax id can wait.
          </Text>

          <Pressable onPress={chooseLogo} style={styles.logoBtn}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.logoEmpty}>
                <Text style={styles.logoPlus}>＋</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.logoH}>Brand mark *</Text>
              <Text style={styles.logoP}>Square. Clean. This sits next to the check.</Text>
            </View>
          </Pressable>

          <Text style={styles.label}>Brand name *</Text>
          <TextInput style={styles.field} value={name} onChangeText={setName} placeholder="Maison…" placeholderTextColor={ph} />

          <Text style={styles.label}>Handle *</Text>
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.field, { flex: 1, marginTop: 0 }]}
              value={handle}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9]/g, ""))}
              placeholder="maison"
              placeholderTextColor={ph}
            />
          </View>

          <Text style={styles.label}>Vertical *</Text>
          <View style={styles.chips}>
            {VERTICALS.map((v) => (
              <Pressable key={v} onPress={() => setVertical(v)} style={[styles.chip, vertical === v && styles.chipOn]}>
                <Text style={[styles.chipTxt, vertical === v && styles.chipTxtOn]}>{v}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Tagline</Text>
          <TextInput
            style={styles.field}
            value={tagline}
            onChangeText={setTagline}
            placeholder="One line buyers read under the name"
            placeholderTextColor={ph}
          />

          <Text style={styles.label}>The story *</Text>
          <TextInput
            style={styles.body}
            value={story}
            onChangeText={setStory}
            placeholder="Who you are, what you make, why this house exists."
            placeholderTextColor={ph}
            multiline
          />

          <Text style={styles.section}>Legal</Text>
          <Text style={styles.label}>Registered / legal name *</Text>
          <TextInput style={styles.field} value={legalName} onChangeText={setLegalName} placeholder="Ltd, LLC, SARL…" placeholderTextColor={ph} />
          <Text style={styles.label}>Registration or tax id</Text>
          <TextInput style={styles.field} value={registrationId} onChangeText={setRegistrationId} placeholder="Optional" placeholderTextColor={ph} />
          <Text style={styles.label}>Brand contact *</Text>
          <Text style={styles.contactHint}>Add at least one: email, phone, WhatsApp, Instagram, or website.</Text>
          <TextInput
            style={styles.field}
            value={contactEmail}
            onChangeText={setContactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email · desk@…"
            placeholderTextColor={ph}
          />
          <TextInput style={styles.field} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={ph} />
          <TextInput style={styles.field} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="WhatsApp number" placeholderTextColor={ph} />
          <TextInput style={styles.field} value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="Website · https://" placeholderTextColor={ph} />
          <TextInput style={styles.field} value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="Instagram · @handle" placeholderTextColor={ph} />
          <Text style={styles.contactState}>
            {hasBrandContact({ phone, whatsapp, instagram, contactEmail, website }) ? `Contact added: ${brandContactHint({ phone, whatsapp, instagram, contactEmail, website })}` : "One reachable contact is required to continue."}
          </Text>
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => void submit()} disabled={!canSubmit} style={[styles.cta, !canSubmit && styles.ctaOff]}>
            <Text style={[styles.ctaTxt, !canSubmit && styles.ctaTxtOff]}>
              {mine?.status === "rejected" ? "Submit again" : "Submit for verification"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {gate.phase !== "idle" ? (
        <View style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          {gate.phase === "review" ? (
            <>
              <OrbitLoader />
              <Text style={styles.gateH}>{VERIFY_STAGES[stage]}</Text>
              <Text style={styles.gateP}>Checking for marketplace-safety signals and possible impersonation.</Text>
            </>
          ) : null}
          {gate.phase === "block" ? (
            <>
              <Text style={styles.gateH}>{gate.headline}</Text>
              {gate.reasons.map((r) => (
                <Text key={r} style={styles.gateP}>
                  {r}
                </Text>
              ))}
              <Text style={styles.gateP}>
                {gate.decision === "human_review"
                  ? "This is a Uvel safety signal, not a legal or trademark decision. No public verification badge has been applied."
                  : gate.decision === "needs_information"
                    ? "Add the missing information, then submit again."
                    : "This outcome is based on Uvel marketplace policy."}
              </Text>
              <Pressable onPress={() => setGate({ phase: "idle" })} style={styles.gateCta}>
                <Text style={styles.ctaTxt}>{gate.decision === "human_review" ? "Review filing" : "Fix filing"}</Text>
              </Pressable>
            </>
          ) : null}
          {gate.phase === "pass" ? (
            <>
              <VerifiedMark size={36} />
              <Text style={styles.gateH}>Uvel review complete.</Text>
              <Text style={styles.gateP}>Your brand passed Uvel’s internal marketplace-safety review. This is not government registration, trademark clearance, or payout verification.</Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.legacyPage },
    top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    backTxt: { color: colors.legacyText, fontSize: 34, lineHeight: 36, marginTop: -4 },
    topTitle: { color: colors.legacyText, fontSize: 16, fontWeight: "600" },
    lede: { color: "rgba(244,240,230,0.58)", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 },
    logoBtn: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 8 },
    logo: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.legacySurface },
    logoEmpty: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: colors.legacySurface,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    logoPlus: { color: colors.legacyText, fontSize: 28 },
    logoH: { color: colors.legacyText, fontWeight: "700", fontSize: 16 },
    logoP: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 4 },
    label: { color: "rgba(244,240,230,0.45)", fontSize: 12, marginTop: 16, letterSpacing: 0.3 },
    contactHint: { color: "rgba(244,240,230,0.55)", fontSize: 13, lineHeight: 18, marginTop: 6 },
    contactState: { color: "rgba(244,240,230,0.45)", fontSize: 12, marginTop: 8, lineHeight: 17 },
    field: {
      marginTop: 8,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.legacySurface,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.12)",
      color: colors.legacyText,
      paddingHorizontal: 14,
      fontSize: 16,
    },
    handleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    at: { color: "rgba(244,240,230,0.45)", fontSize: 18, fontWeight: "700" },
    body: {
      marginTop: 8,
      minHeight: 110,
      borderRadius: 14,
      backgroundColor: colors.legacySurface,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.12)",
      color: colors.legacyText,
      paddingHorizontal: 14,
      paddingTop: 12,
      fontSize: 16,
      textAlignVertical: "top",
    },
    section: { color: colors.legacyText, fontFamily: "Georgia", fontSize: 22, marginTop: 28 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: colors.legacyText, borderColor: colors.legacyText },
    chipTxt: { color: colors.legacyText, fontSize: 13, fontWeight: "600" },
    chipTxtOn: { color: colors.legacyInk },
    foot: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.legacyPage },
    cta: { height: 52, borderRadius: 26, backgroundColor: colors.legacyText, alignItems: "center", justifyContent: "center" },
    ctaOff: { backgroundColor: "#2A2824" },
    ctaTxt: { color: colors.legacyInk, fontWeight: "800", fontSize: 16 },
    ctaTxtOff: { color: "rgba(244,240,230,0.35)" },
    gate: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(11,10,8,0.96)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 12,
    },
    gateH: { color: colors.legacyText, fontFamily: "Georgia", fontSize: 28, textAlign: "center", marginTop: 8 },
    gateP: { color: "rgba(244,240,230,0.6)", fontSize: 15, textAlign: "center", lineHeight: 22 },
    gateCta: {
      marginTop: 18,
      height: 48,
      paddingHorizontal: 28,
      borderRadius: 24,
      backgroundColor: colors.legacyText,
      alignItems: "center",
      justifyContent: "center",
    },
    done: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
    doneH: { color: colors.legacyText, fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
    doneP: { color: "rgba(244,240,230,0.58)", textAlign: "center", lineHeight: 22, marginBottom: 12 },
    doneCta: {
      marginTop: 8,
      minHeight: 52,
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.legacyText,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
