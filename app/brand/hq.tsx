import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandVerifiedMark } from "../../components/VerifiedMark";
import { BrandHQSkeleton } from "../../components/ScreenSkeletons";
import {
  brandApproved,
  brandCheck,
  canAccessHQ,
  canManageCatalog,
  canManageOrders,
  canViewAudit,
  canManageTeam,
  canViewOrders,
  canSeeAnalytics,
  canStudio,
  getBrand,
  inquiryRecipients,
  memberRoleLabel,
  roleOn,
  themeFor,
  updateBrand,
  useBrands,
  useBrandsHydrated,
  type Brand,
  type BrandMember,
  type MemberRole,
  canManagePayouts,
  canViewFinance,
  canManageMarketing,
  canViewMarketing,
  updateMemberRole,
} from "../../lib/brands";
import { OrbitLoader } from "../../components/OrbitLoader";
import { enrollMake, brandMakes } from "../../lib/brandMake";
import { usd } from "../../lib/catalog";
import { financeTotals, requestBrandPayout, savePayoutProfile, settlementLedger, usePayoutProfile, usePayouts, type PayoutDestinationType, type PayoutOwnerType, type SettlementEntry } from "../../lib/finance";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { MARKETS, getMarket, moneyExact } from "../../lib/markets";
import { recordAuditEvent, useAudit, type AuditEvent } from "../../lib/audit";
import { createOrderShipment, reviewOrderResolution, updateOrderFulfillment, updateOrderShipment, useOrders, watchBrandOrders, type FulfillmentStatus, type Order, type ShippingExceptionCode } from "../../lib/orders";
import { addSupportInternalNote, updateSupportCase, useSupportCases, type SupportCase, type SupportStatus } from "../../lib/support";
import { archivePiece, createBrandCatalogRemote, duplicatePiece, restorePiece, updateBrandCatalogRemote, updatePiece, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { shipsToLabel } from "../../lib/ships";
import { readBrandAnalytics } from "../../lib/analytics";
import { buildGrowthSnapshot } from "../../lib/growth";
import { summarizeCampaignAttributionByChannel, useCampaignAttributionReport } from "../../lib/attribution";
import { analyticsCurrencyValue, analyticsDisplayState, analyticsDisclosure, analyticsValue, type AnalyticsDisplayState } from "../../lib/analyticsDisplay";
import { semanticStatus, semanticLabel, statusToneFor } from "../../lib/status";
import { saveBrandCampaign, saveBrandCollection, saveBrandPromotion, useMarketing, type BrandCampaign, type BrandCollection, type BrandPromotion, type MarketingState, type MarketingStatus } from "../../lib/marketing";
import { alertKindLabel, enableAlert, setAlertPreference, useAlertCenter, type AlertKind } from "../../lib/alerts";
import { latestFounderDraft, refreshFounderProjects, simpleStageOf, useFounderProjects, type FounderProject } from "../../lib/founder";
import BrandPromoCodes from "../../components/BrandPromoCodes";
import { importFounderWork, pickFromLibrary } from "../../lib/photo";

type Section = "overview" | "make" | "catalog" | "orders" | "finance" | "more" | "promoCodes" | "growth" | "support" | "inbox" | "analytics" | "audit" | "team" | "settings" | "businessRegistration" | "trademark";

type CatalogAuditInput = Parameters<typeof recordAuditEvent>[0];

function syncCatalogEdit(id: string, patch: Partial<ClosetPiece>, audit?: CatalogAuditInput) {
  void updateBrandCatalogRemote(id, patch)
    .then((remote) => { if (!remote && audit) void recordAuditEvent(audit); })
    .catch(() => { if (audit) void recordAuditEvent(audit); });
}
type HQTheme = { bg: string; ink: string; muted: string; card: string; accent: string; accentInk: string; lineColor: string };

const PRIMARY: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "make", label: "Make" },
  { id: "catalog", label: "Catalog" },
  { id: "orders", label: "Orders" },
  { id: "finance", label: "Money" },
  { id: "more", label: "More" },
];

const MORE_ROOMS: Array<{ id: Section; label: string; copy: string }> = [
  { id: "promoCodes", label: "Promo codes", copy: "Discount codes for your brand" },
  { id: "growth", label: "Growth", copy: "What’s working" },
  { id: "support", label: "Support", copy: "Order problems" },
  { id: "inbox", label: "Inbox", copy: "Buyer messages" },
  { id: "analytics", label: "Analytics", copy: "The numbers" },
  { id: "audit", label: "Activity", copy: "What changed recently" },
  { id: "businessRegistration", label: "Business registration", copy: "Register and verify your business" },
  { id: "trademark", label: "Trademark protection", copy: "Protect a name or logo" },
  { id: "team", label: "Team", copy: "Who can do what" },
  { id: "settings", label: "Settings", copy: "Name, country, page" },
];

const MORE_IDS = new Set<Section>(["more", "promoCodes", "growth", "support", "inbox", "analytics", "audit", "businessRegistration", "trademark", "team", "settings"]);

const ROLE_OPTIONS: Array<Exclude<MemberRole, "owner">> = [
  "admin",
  "merchandiser",
  "marketing",
  "support",
  "finance",
  "viewer",
  "poster",
];

export default function BrandHQ() {
  const { id, section: requestedSection } = useLocalSearchParams<{ id: string; section?: string }>();
  useBrands();
  const brandsReady = useBrandsHydrated();
  const app = useUvel();
  const founderState = useFounderProjects();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const orders = useOrders();
  const auditEvents = useAudit(id || "");
  const supportCases = useSupportCases(id || "");
  const marketing = useMarketing(id || "");
  const payouts = usePayouts(id || "");
  const brand = getBrand(id);
  const theme: HQTheme = brand ? themeFor(brand) : { bg: colors.ink, ink: colors.bone, muted: colors.muted, card: colors.surface, accent: colors.pulse, accentInk: colors.ink, lineColor: colors.subtle };
  const styles = useMemo(() => make(theme), [theme]);
  const [section, setSection] = useState<Section>(requestedSection === "promoCodes" ? "promoCodes" : "overview");
  const hqScroller = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    void refreshFounderProjects();
  }, []));

  useEffect(() => {
    if (!id) return;
    return watchBrandOrders(id);
  }, [id]);

  if (!brandsReady) return <BrandHQSkeleton colors={colors} />;

  const draftProject = latestFounderDraft(founderState.projects);

  if (!brand) {
    return (
      <View style={[styles.page, { backgroundColor: colors.ink, paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.entryBack}><Text style={[styles.backTxt, { color: colors.bone }]}>‹</Text></Pressable>
        <FounderHQEntry project={draftProject} theme={{ bg: colors.ink, ink: colors.bone, muted: colors.muted, card: colors.surface, accent: colors.success, accentInk: colors.successInk, lineColor: colors.subtle }} styles={styles} />
      </View>
    );
  }

  if (!canAccessHQ(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backTxt}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Brand HQ is for the brand team.</Text>
      </View>
    );
  }

  if (!brandApproved(brand)) {
    return (
      <View style={[styles.page, { backgroundColor: theme.bg, paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={styles.entryBack}><Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text></Pressable>
        <ReviewWaiting theme={theme} styles={styles} />
      </View>
    );
  }

  const activeBrand = brand;
  const catalog = pieces.filter((piece) => piece.brandId === activeBrand.id);
  const activeCatalog = catalog.filter((piece) => piece.status === "listed");
  const brandOrders = orders.filter((order) => order.brandId === activeBrand.id);
  const making = brandMakes(activeBrand);
  const toShipCount = brandOrders.filter((order) => order.status === "paid" && ["unfulfilled", "processing", "packed"].includes(order.fulfillmentStatus || "unfulfilled")).length;
  const moneyCurrency = getMarket(activeBrand.country).currency;
  const money = financeTotals(settlementLedger(brandOrders, activeBrand.id), payouts, moneyCurrency);
  const manager = canManageTeam(activeBrand, app.uid);
  const orderViewer = canViewOrders(activeBrand, app.uid);
  const orderManager = canManageOrders(activeBrand, app.uid);
  const orderReviewer = ["owner", "admin", "support", "finance"].includes(roleOn(activeBrand, app.uid) || "");
  const catalogManager = canManageCatalog(activeBrand, app.uid);

  function openSection(next: Section) {
    if (next === "inbox") {
      router.push("/inbox");
      return;
    }
    setSection(next);
  }

  function changeRole(member: BrandMember) {
    if (!manager || member.role === "owner") return;
    Alert.alert(`Role for ${member.name}`, "Choose the access this person should have in Brand HQ.", [
      ...ROLE_OPTIONS.map((role) => ({ text: memberRoleLabel(role), onPress: () => { updateMemberRole(activeBrand.id, member.uid, role); void recordAuditEvent({ brandId: activeBrand.id, action: "team_role_updated", entity: "team", entityId: member.uid, entityName: member.name, summary: `${member.name} changed to ${memberRoleLabel(role)}.` }); } })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <ScrollView ref={hqScroller} style={{ flex: 1 }} nestedScrollEnabled contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 240 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text>
          </Pressable>
          <View style={styles.topBrand}>
            <View style={styles.topNameRow}>
              <Text style={[styles.topTitle, { color: theme.ink }]} numberOfLines={1}>{brand.name}</Text>
              <BrandVerifiedMark brand={brand} size={16} />
            </View>
          </View>
          <View style={styles.topSpacer} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {PRIMARY.map((item) => {
            const active = item.id === "more" ? MORE_IDS.has(section) : section === item.id;
            return (
              <Pressable key={item.id} onPress={() => openSection(item.id)} style={[styles.navChip, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                <Text style={[styles.navTxt, { color: active ? theme.accentInk : theme.ink }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {section === "overview" ? (
          <Overview
            brand={brand}
            catalogCount={activeCatalog.length}
            toShipCount={toShipCount}
            making={making}
            moneyLabel={moneyExact(money.availableCents, moneyCurrency)}
            pendingLabel={money.pendingCents ? moneyExact(money.pendingCents, moneyCurrency) : ""}
            theme={theme}
            styles={styles}
            onSection={openSection}
          />
        ) : section === "make" ? (
          <MakeSection brand={brand} uid={app.uid} theme={theme} styles={styles} />
        ) : section === "catalog" ? (
          <CatalogSection brand={brand} items={catalog} canManage={catalogManager} theme={theme} styles={styles} />
        ) : section === "orders" ? (
          <OrdersSection orders={brandOrders} madeByUvel={making} viewer={orderViewer} manager={orderManager} reviewer={orderReviewer} theme={theme} styles={styles} />
        ) : section === "finance" ? (
          <FinanceSection brand={activeBrand} orders={brandOrders} viewer={canViewFinance(activeBrand, app.uid)} manager={canManagePayouts(activeBrand, app.uid)} theme={theme} styles={styles} onPayoutFocus={() => setTimeout(() => hqScroller.current?.scrollToEnd({ animated: true }), 160)} />
        ) : section === "promoCodes" ? (
          <BrandPromoCodes brand={activeBrand} theme={theme} state={marketing} pieces={catalog} viewer={canViewMarketing(activeBrand, app.uid)} manager={canManageMarketing(activeBrand, app.uid)} />
        ) : section === "growth" ? (
          <GrowthToolsSection brand={activeBrand} uid={app.uid} orders={brandOrders} pieces={catalog} viewer={canSeeAnalytics(activeBrand, app.uid)} theme={theme} styles={styles} onSection={openSection} />
        ) : section === "analytics" ? (
          <AdvancedAnalyticsSection brand={activeBrand} orders={brandOrders} pieces={catalog} marketing={marketing} viewer={canSeeAnalytics(activeBrand, app.uid)} theme={theme} styles={styles} />
        ) : section === "support" ? (
          <SupportSection brand={activeBrand} cases={supportCases} manager={orderManager} theme={theme} styles={styles} viewerName={app.displayName || "Support agent"} />
        ) : section === "audit" ? (
          <AuditSection events={auditEvents} viewer={canViewAudit(activeBrand, app.uid)} theme={theme} styles={styles} onSection={openSection} />
        ) : section === "more" ? (
          <MoreSection brand={brand} uid={app.uid} theme={theme} styles={styles} onSection={openSection} />
        ) : section === "team" ? (
          <TeamSection brand={brand} manager={manager} theme={theme} styles={styles} onRole={changeRole} />
        ) : section === "businessRegistration" ? (
          <BusinessRegistrationSection brand={brand} uid={app.uid} theme={theme} styles={styles} />
        ) : section === "settings" ? (
          <SettingsSection brand={brand} uid={app.uid} theme={theme} styles={styles} onSection={openSection} />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FounderHQEntry({ project, theme, styles }: { project?: FounderProject; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const continueApplying = Boolean(project);
  return (
    <View style={styles.entryWrap}>
      <View style={[styles.entryIcon, { backgroundColor: theme.card }]}><Image source={require("../../assets/icon.png")} style={styles.entryIconImage} contentFit="cover" accessible={false} /></View>
      <Text style={[styles.entryTitle, { color: theme.ink }]}>{continueApplying ? "Your brand idea is waiting" : "Interested in becoming a brand?"}</Text>
      <Text style={[styles.entryCopy, { color: theme.muted }]}>{continueApplying ? "Pick up where you left off in Founder Studio and finish your application." : "Go from idea to brand in just seconds with Founder Studio."}</Text>
      <Pressable onPress={() => project ? router.push({ pathname: "/brand/founder/[stage]", params: { id: project.id, stage: simpleStageOf(project.stage) } }) : router.push("/brand/founder")} style={[styles.entryButton, { backgroundColor: theme.accent }]}>
        <Text style={[styles.entryButtonText, { color: theme.accentInk }]}>{continueApplying ? "Continue applying" : "Open Founder Studio"}</Text>
      </Pressable>
    </View>
  );
}

function ReviewWaiting({ theme, styles }: { theme: HQTheme; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.entryWrap}>
      <View style={[styles.entryIcon, { backgroundColor: theme.card }]}><OrbitLoader size={24} /></View>
      <Text style={[styles.entryTitle, { color: theme.ink }]}>Your brand is in review</Text>
      <Text style={[styles.entryCopy, { color: theme.muted }]}>We’re taking a look. Brand HQ will open when your review is complete.</Text>
    </View>
  );
}

function Overview({
  brand,
  catalogCount,
  toShipCount,
  making,
  moneyLabel,
  pendingLabel,
  theme,
  styles,
  onSection,
}: {
  brand: Brand;
  catalogCount: number;
  toShipCount: number;
  making: boolean;
  moneyLabel: string;
  pendingLabel: string;
  theme: HQTheme;
  styles: ReturnType<typeof make>;
  onSection: (section: Section) => void;
}) {
  return (
    <View>
      {!brandApproved(brand) ? (
        <Pressable onPress={() => router.push({ pathname: "/brand/studio", params: { id: brand.id } })} style={[styles.hero, { backgroundColor: theme.card, marginBottom: 16 }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.ink }]}>In review</Text>
            <Text style={[styles.heroP, { color: theme.muted }]}>Dress the page while we look at it. Logo, banner, look.</Text>
          </View>
        </Pressable>
      ) : null}
      <View style={styles.stats}>
        <Stat label="Listed" value={String(catalogCount)} theme={theme} styles={styles} />
        <Stat label={making ? "Making" : "To ship"} value={String(toShipCount)} theme={theme} styles={styles} />
        <Stat label="Money" value={moneyLabel} theme={theme} styles={styles} />
      </View>
      {pendingLabel ? <Text style={[styles.note, { marginTop: 10, color: theme.muted }]}>{pendingLabel} still pending</Text> : null}
      {brandApproved(brand) ? (
        <>
          <ActionCard title="Make" copy={making ? "Uvel makes it. The manufacturer sends it." : "We make the clothes. You don’t pack."} button="Make" onPress={() => onSection("make")} theme={theme} styles={styles} />
          <ActionCard title="List a piece" copy="Add something to the shop." button="List" onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })} theme={theme} styles={styles} />
          <ActionCard title="Orders" copy={making ? "What’s being made." : "Pack what’s sold."} button="Orders" onPress={() => onSection("orders")} theme={theme} styles={styles} />
          <ActionCard title="Get paid" copy="Money from sales." button="Money" onPress={() => onSection("finance")} theme={theme} styles={styles} />
        </>
      ) : null}
      {brandApproved(brand) ? <Text style={[styles.note, { color: theme.muted }]}>{brandCheck(brand) === "lime" ? `Green check · two sales · ${brand.country}` : brandCheck(brand) === "blue" ? `Verified brand · ${brand.country}` : `Sell two pieces. Then the green check goes on your name.`}</Text> : null}
    </View>
  );
}

function MakeSection({
  brand,
  uid,
  theme,
  styles,
}: {
  brand: Brand;
  uid: string;
  theme: HQTheme;
  styles: ReturnType<typeof make>;
}) {
  const owner = roleOn(brand, uid) === "owner" || roleOn(brand, uid) === "admin";
  const making = brandMakes(brand);
  const approved = brandApproved(brand);

  function turnOnMake() {
    if (!owner || !approved) return;
    Alert.alert("Make with Uvel", "We make the piece. The manufacturer sends it to the buyer. Delivery is paid at checkout. Production comes out of the sale.", [
      { text: "Not now", style: "cancel" },
      {
        text: "Make with Uvel",
        onPress: () => {
          enrollMake(brand.id);
          void recordAuditEvent({ brandId: brand.id, action: "make_enrolled", entity: "brand", entityId: brand.id, entityName: brand.name, summary: "Uvel makes this brand’s pieces." });
        },
      },
    ]);
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Make</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>We make it. The manufacturer sends it. The buyer pays delivery.</Text>

      <View style={[styles.makeCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.makeKicker, { color: theme.muted }]}>{making ? "ON" : "OFF"}</Text>
        <Text style={[styles.makeTitle, { color: theme.ink }]}>We make your pieces</Text>
        <Text style={[styles.makeCopy, { color: theme.muted }]}>
          {making
            ? "Listings from this brand are made to order. You don’t pack. When someone buys, we send it to the manufacturer and they ship it."
            : "You don’t hold stock. Someone orders, we make it, they receive it. Turn this on to sell that way."}
        </Text>
        {making ? (
          <Text style={[styles.makeStatus, { color: theme.ink }]}>Uvel is making for this brand.</Text>
        ) : (
          <Pressable
            onPress={turnOnMake}
            disabled={!owner || !approved}
            style={[styles.makeBtn, { backgroundColor: theme.accent }, (!owner || !approved) && { opacity: 0.4 }]}
          >
            <Text style={[styles.makeBtnTxt, { color: theme.accentInk }]}>{approved ? "Make with Uvel" : "After you’re accepted"}</Text>
          </Pressable>
        )}
      </View>

    </View>
  );
}

function MoreSection({
  brand,
  uid,
  theme,
  styles,
  onSection,
}: {
  brand: Brand;
  uid: string;
  theme: HQTheme;
  styles: ReturnType<typeof make>;
  onSection: (section: Section) => void;
}) {
  return (
    <View>
      {MORE_ROOMS.map((item) => {
        const locked = (item.id === "analytics" && !canSeeAnalytics(brand, uid)) || (item.id === "audit" && !canViewAudit(brand, uid));
        return (
          <Pressable
            key={item.id}
            onPress={() => item.id === "trademark" ? router.push({ pathname: "/brand/trademark", params: { id: brand.id } }) : onSection(item.id)}
            style={[styles.moreRow, { backgroundColor: theme.card }, locked && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.moreTitle, { color: theme.ink }]}>{item.label}</Text>
              <Text style={[styles.moreCopy, { color: theme.muted }]}>{item.copy}</Text>
            </View>
            <Text style={[styles.moreGo, { color: theme.muted }]}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type CatalogFilter = "all" | "active" | "draft" | "archived" | "sold";
const CATALOG_FILTERS: Array<{ id: CatalogFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
  { id: "sold", label: "Sold" },
];

function CatalogSection({ brand, items, canManage, theme, styles }: { brand: Brand; items: ClosetPiece[]; canManage: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const [marketCode, setMarketCode] = useState(getMarket(brand.country).code);
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [alertKind, setAlertKind] = useState<AlertKind>("both");
  const [alertBusy, setAlertBusy] = useState(false);
  const app = useUvel();
  const { preferences } = useAlertCenter(app.uid);
  const market = getMarket(marketCode);
  const filteredItems = items.filter((item) => filter === "all" || (filter === "active" ? item.status === "listed" : item.status === filter));
  const watchedIds = new Set(preferences.map((preference) => preference.listingId));

  async function watchWholeCatalog() {
    if (!app.uid || !items.length || alertBusy) return;
    setAlertBusy(true);
    try {
      const first = items[0];
      await enableAlert(app.uid, first, alertKind);
      for (const item of items.slice(1)) {
        await setAlertPreference(app.uid, item, alertKind);
      }
      Alert.alert("Catalog alerts enabled", `${alertKindLabel(alertKind)} are now watching all ${items.length} Founder Studio / Brand HQ product${items.length === 1 ? "" : "s"}. Changes recorded in the catalog will appear in Notifications.`);
    } finally {
      setAlertBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Catalog</Text>
          <Text style={[styles.sectionP, { color: theme.muted }]}>Your product floor, stock signals, and listing status.</Text>
        </View>
        {canManage ? <Pressable onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })} style={[styles.smallCta, { backgroundColor: theme.accent }]}><Text style={[styles.smallCtaTxt, { color: theme.accentInk }]}>Add product</Text></Pressable> : null}
      </View>
      {canManage ? (
        <View style={[styles.bulkCard, { backgroundColor: theme.card }]}>
          <View style={styles.bulkHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bulkTitle, { color: theme.ink }]}>Price & restock alerts</Text>
              <Text style={[styles.bulkP, { color: theme.muted }]}>Watch the whole Founder Studio / Brand HQ catalog, not just one marketplace listing. {watchedIds.size}/{items.length} product{items.length === 1 ? " is" : "s are"} currently watched.</Text>
            </View>
          </View>
          <View style={styles.catalogAlertOptions}>
            {(["price_drop", "restock", "both"] as const).map((kind) => (
              <Pressable key={kind} onPress={() => setAlertKind(kind)} style={[styles.orderFilter, { borderColor: alertKind === kind ? theme.accent : theme.lineColor, backgroundColor: alertKind === kind ? theme.accent : theme.card }]}>
                <Text style={[styles.orderFilterTxt, { color: alertKind === kind ? theme.accentInk : theme.ink }]}>{kind === "price_drop" ? "Price drops" : kind === "restock" ? "Restocks" : "Both"}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => void watchWholeCatalog()} disabled={alertBusy || !items.length} style={[styles.bulkButton, { backgroundColor: theme.accent, opacity: alertBusy || !items.length ? 0.55 : 1 }]}>
            <Text style={[styles.bulkButtonTxt, { color: theme.accentInk }]}>{alertBusy ? "Enabling…" : "Watch whole catalog"}</Text>
          </Pressable>
        </View>
      ) : null}
      <Text style={[styles.marketKicker, { color: theme.muted }]}>MANAGE A MARKET</Text>
      <Text style={[styles.marketSummary, { color: theme.ink }]}>{market.name} · {market.currency}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketPicker}>
        {MARKETS.map((option) => {
          const selected = option.code === market.code;
          return <Pressable key={option.code} onPress={() => setMarketCode(option.code)} style={[styles.marketChip, { borderColor: selected ? theme.accent : theme.lineColor, backgroundColor: selected ? theme.accent : theme.card }]}><Text style={[styles.marketChipCode, { color: selected ? theme.accentInk : theme.ink }]}>{option.code}</Text><Text style={[styles.marketChipName, { color: selected ? theme.accentInk : theme.muted }]}>{option.name}</Text></Pressable>;
        })}
      </ScrollView>
      <Text style={[styles.marketHint, { color: theme.muted }]}>Prices and availability below are for {market.name}. Shipping coverage stays tied to each product’s approved destinations.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalogFilters}>
        {CATALOG_FILTERS.map((option) => <Pressable key={option.id} onPress={() => setFilter(option.id)} style={[styles.orderFilter, { borderColor: filter === option.id ? theme.accent : theme.lineColor, backgroundColor: filter === option.id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === option.id ? theme.accentInk : theme.ink }]}>{option.label}</Text></Pressable>)}
      </ScrollView>
      {filteredItems.length ? (
        <>
          {canManage && filter !== "sold" ? <BulkUpdate key={`bulk-${market.code}-${filter}`} items={filteredItems} brandId={brand.id} marketCode={market.code} theme={theme} styles={styles} /> : null}
          {filteredItems.map((item) => <CatalogRow key={`${item.id}-${market.code}`} item={item} brandId={brand.id} canManage={canManage} marketCode={market.code} theme={theme} styles={styles} />)}
        </>
      ) : <Empty text={items.length ? "No products match this view." : "No products in this catalog yet."} theme={theme} styles={styles} />}
    </View>
  );
}

function BulkUpdate({ items, brandId, marketCode, theme, styles }: { items: ClosetPiece[]; brandId: string; marketCode: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const market = getMarket(marketCode);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  function apply() {
    const priceCents = Math.round(Number(price) * 100);
    const stockUnits = Math.round(Number(stock));
    if (!Number.isFinite(priceCents) || priceCents <= 0 || !Number.isFinite(stockUnits) || stockUnits < 0) {
      Alert.alert("Catalog update", `Enter a valid ${market.currency} price and stock quantity.`);
      return;
    }
    items.forEach((item) => {
      const patch = { listPriceCents: priceCents, stockQuantity: stockUnits, marketPrices: { ...(item.marketPrices || {}), [market.code]: priceCents } };
      updatePiece(item.id, patch);
      syncCatalogEdit(item.id, patch, { brandId, action: "product_updated", entity: "product", entityId: item.id, entityName: item.name, summary: `Bulk catalog update for ${market.code}.`, metadata: { market: market.code, priceCents, stockUnits } });
    });
    setPrice("");
    setStock("");
    Alert.alert("Catalog updated", `${items.length} product${items.length === 1 ? "" : "s"} updated for ${market.name}.`);
  }

  return (
    <View style={[styles.bulkCard, { backgroundColor: theme.card }]}>
      <View style={styles.bulkHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bulkTitle, { color: theme.ink }]}>Bulk update · {market.code}</Text>
          <Text style={[styles.bulkP, { color: theme.muted }]}>Apply one market price and stock quantity to the full catalog.</Text>
        </View>
        <Text style={[styles.bulkCurrency, { color: theme.accent }]}>{market.currency}</Text>
      </View>
      <View style={styles.bulkFields}>
        <TextInput value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9.]/g, ""))} placeholder="Price" placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={[styles.bulkInput, { color: theme.ink, borderColor: theme.lineColor }]} />
        <TextInput value={stock} onChangeText={(value) => setStock(value.replace(/[^0-9]/g, ""))} placeholder="Stock" placeholderTextColor={theme.muted} keyboardType="number-pad" style={[styles.bulkInput, { color: theme.ink, borderColor: theme.lineColor }]} />
        <Pressable onPress={apply} style={[styles.bulkButton, { backgroundColor: theme.accent }]}><Text style={[styles.bulkButtonTxt, { color: theme.accentInk }]}>Apply</Text></Pressable>
      </View>
    </View>
  );
}

function CatalogRow({ item, brandId, canManage, marketCode, theme, styles }: { item: ClosetPiece; brandId: string; canManage: boolean; marketCode: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const market = getMarket(marketCode);
  const stock = typeof item.stockQuantity === "number" ? item.stockQuantity : null;
  const sizes = item.sizes?.length ? item.sizes : item.size ? [item.size] : [];
  const initialSizeStock = Object.fromEntries(sizes.map((size) => [size, String(item.sizeStock?.[size] ?? item.stockQuantity ?? 0)]));
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(String((item.marketPrices?.[market.code] ?? item.listPriceCents) / 100));
  const [sizeStock, setSizeStock] = useState<Record<string, string>>(initialSizeStock);
  const [available, setAvailable] = useState(item.marketAvailability?.[market.code] ?? true);

  function audit(action: string, summary: string, metadata?: Record<string, string | number | boolean>) {
    void recordAuditEvent({ brandId, action, entity: "product", entityId: item.id, entityName: item.name, summary, metadata });
  }

  function actions() {
    const options = [
      "Open listing",
      ...(canManage && item.status === "listed" ? ["Move to draft", "Archive product"] : []),
      ...(canManage && (item.status === "draft" || item.status === "owned") ? ["Publish product", "Archive product"] : []),
      ...(canManage && item.status === "archived" ? ["Restore to draft"] : []),
      ...(canManage && item.status !== "sold" ? ["Duplicate product"] : []),
      "Cancel",
    ];
    const buttons: Array<{ text: string; onPress?: () => void; style?: "cancel" | "default" | "destructive" }> = options
      .filter((option) => option !== "Cancel")
      .map((option) => ({ text: option, onPress: () => {
        if (option === "Open listing") router.push({ pathname: "/closet/[id]", params: { id: item.id } });
        if (option === "Move to draft") { const patch = { status: "draft" as const }; updatePiece(item.id, patch); syncCatalogEdit(item.id, patch, { brandId, action: "product_drafted", entity: "product", entityId: item.id, entityName: item.name, summary: "Product moved to draft." }); }
        if (option === "Archive product") { const patch = { status: "archived" as const }; archivePiece(item.id); syncCatalogEdit(item.id, patch, { brandId, action: "product_archived", entity: "product", entityId: item.id, entityName: item.name, summary: "Product archived." }); }
        if (option === "Publish product") { if ((item.stockQuantity || 0) <= 0) { Alert.alert("Inventory required", "Add at least one unit before publishing this product."); return; } const patch = { status: "listed" as const }; updatePiece(item.id, patch); syncCatalogEdit(item.id, patch, { brandId, action: "product_published", entity: "product", entityId: item.id, entityName: item.name, summary: "Product published." }); }
        if (option === "Restore to draft") { const patch = { status: "draft" as const }; restorePiece(item.id); syncCatalogEdit(item.id, patch, { brandId, action: "product_restored", entity: "product", entityId: item.id, entityName: item.name, summary: "Product restored to draft." }); }
        if (option === "Duplicate product") { const copy = duplicatePiece(item.id); if (copy) { void createBrandCatalogRemote(copy).then((remote) => { if (!remote) void recordAuditEvent({ brandId, action: "product_duplicated", entity: "product", entityId: copy.id, entityName: copy.name, summary: `Duplicated from ${item.name}.`, metadata: { sourceId: item.id } }); }).catch(() => void recordAuditEvent({ brandId, action: "product_duplicated", entity: "product", entityId: copy.id, entityName: copy.name, summary: `Duplicated from ${item.name}.`, metadata: { sourceId: item.id } })); } }
      } }));
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(item.name, undefined, buttons);
  }

  function saveCatalogFields() {
    const nextSizeStock = Object.fromEntries(Object.entries(sizeStock).map(([size, value]) => [size, Math.max(0, Math.round(Number(value) || 0))]));
    const total = sizes.length ? Object.values(nextSizeStock).reduce((sum, value) => sum + value, 0) : Math.max(0, Math.round(Number(sizeStock.total || stock || 0)));
    if (item.status === "listed" && total <= 0) {
      Alert.alert("Inventory required", "A listed product must have at least one sellable unit.");
      return;
    }
    const priceCents = Math.max(1, Math.round(Number(price) * 100));
    const patch: Partial<ClosetPiece> = {
      listPriceCents: priceCents,
      stockQuantity: total,
      marketPrices: { ...(item.marketPrices || {}), [market.code]: priceCents },
      marketAvailability: { ...(item.marketAvailability || {}), [market.code]: available },
    };
    if (sizes.length) patch.sizeStock = nextSizeStock;
    updatePiece(item.id, patch);
    syncCatalogEdit(item.id, patch, { brandId, action: "product_updated", entity: "product", entityId: item.id, entityName: item.name, summary: "Product catalog fields updated.", metadata: { market: market.code, priceCents, stockUnits: total, available } });
    setExpanded(false);
  }

  return (
    <View style={[styles.catalogWrap, { backgroundColor: theme.card }]}>
      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.catalogRow}>
        {item.photo ? <Image cachePolicy="memory-disk" source={{ uri: item.photo }} style={styles.catalogImg} contentFit="cover" /> : <View style={[styles.catalogImg, { backgroundColor: theme.bg }]} />}
        <View style={styles.catalogCopy}>
          <Text style={[styles.catalogName, { color: theme.ink }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.catalogMeta, { color: theme.muted }]}>{item.status === "listed" ? "Active" : item.status === "sold" ? "Sold" : item.status === "archived" ? "Archived" : "Draft"} · {item.sku || "SKU pending"}</Text>
          <Text style={[styles.catalogPrice, { color: theme.ink }]}>{usd(item.marketPrices?.[market.code] ?? item.listPriceCents, market.currency)}{stock !== null ? ` · ${stock} in stock` : ""}</Text>
        </View>
        {stock !== null && stock > 0 && stock <= 10 ? <View style={[styles.stockPill, { backgroundColor: theme.accent }]}><Text style={[styles.stockTxt, { color: theme.accentInk }]}>{stock} left</Text></View> : null}
        <Text style={[styles.rowArrow, { color: theme.ink }]}>{expanded ? "⌃" : "›"}</Text>
      </Pressable>
      {expanded && canManage ? (
        <View style={[styles.editor, { borderTopColor: theme.lineColor }]}>
          <View style={styles.editorTop}><Text style={[styles.editorKicker, { color: theme.muted }]}>CATALOG CONTROLS · {market.code}</Text><Switch value={available} onValueChange={setAvailable} trackColor={{ false: theme.lineColor, true: theme.accent }} thumbColor={available ? theme.accentInk : theme.muted} /></View>
          <Text style={[styles.editorLabel, { color: theme.muted }]}>Market availability · {available ? "Available" : "Hidden"}</Text>
          <Text style={[styles.shippingContext, { color: theme.muted }]}>Shipping coverage · {shipsToLabel(item.country || market.code, item.shipsTo)}</Text>
          <TextInput value={price} onChangeText={(value) => setPrice(value.replace(/[^0-9.]/g, ""))} placeholder={`${market.currency} price`} placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={[styles.editorInput, { color: theme.ink, borderColor: theme.lineColor }]} />
          <Text style={[styles.editorLabel, { color: theme.muted }]}>Stock by size</Text>
          {sizes.length ? sizes.map((size) => <View key={size} style={styles.variantRow}><Text style={[styles.variantName, { color: theme.ink }]}>{size}</Text><TextInput value={sizeStock[size] || "0"} onChangeText={(value) => setSizeStock((current) => ({ ...current, [size]: value.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" style={[styles.variantInput, { color: theme.ink, borderColor: theme.lineColor }]} /></View>) : <TextInput value={sizeStock.total || String(stock || 0)} onChangeText={(value) => setSizeStock((current) => ({ ...current, total: value.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" style={[styles.editorInput, { color: theme.ink, borderColor: theme.lineColor }]} />}
          <View style={styles.editorActions}><Pressable onPress={actions} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>More actions</Text></Pressable><Pressable onPress={saveCatalogFields} style={[styles.saveButton, { backgroundColor: theme.accent }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>Save changes</Text></Pressable></View>
        </View>
      ) : expanded ? <Text style={[styles.readOnly, { color: theme.muted }]}>Your role can view this catalog, but cannot edit inventory.</Text> : null}
    </View>
  );
}

type OrderFilter = "all" | "action" | "processing" | "packed" | "shipped" | "completed" | "canceled";

const ORDER_FILTERS: Array<{ id: OrderFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "action", label: "Needs action" },
  { id: "processing", label: "Processing" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped" },
  { id: "completed", label: "Completed" },
  { id: "canceled", label: "Canceled" },
];

function OrdersSection({ orders, madeByUvel, viewer, manager, reviewer, theme, styles }: { orders: Order[]; madeByUvel?: boolean; viewer: boolean; manager: boolean; reviewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  if (!viewer) {
    return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Orders</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Order operations are limited to the brand owner, admins, support, and finance team.</Text></View>;
  }
  const needsAction = orders.filter((order) => order.status === "paid" && ["unfulfilled", "processing", "packed"].includes(order.fulfillmentStatus || "unfulfilled"));
  const filtered = orders.filter((order) => {
    const status = order.fulfillmentStatus || (order.status === "paid" ? "unfulfilled" : undefined);
    if (filter === "all") return true;
    if (filter === "action") return needsAction.includes(order);
    if (filter === "completed") return status === "delivered";
    if (filter === "canceled") return status === "canceled" || status === "returned" || order.status === "failed";
    return status === filter;
  });
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Orders</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>{madeByUvel ? "Uvel makes these. The manufacturer sends them. Delivery is already paid." : "Payment, fulfillment, tracking, and buyer context in one operating view."}</Text>
      <View style={styles.orderStats}>
        <Stat label="All orders" value={String(orders.length)} theme={theme} styles={styles} />
        <Stat label={madeByUvel ? "Making" : "Needs action"} value={String(needsAction.length)} theme={theme} styles={styles} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>
        {ORDER_FILTERS.map((option) => <Pressable key={option.id} onPress={() => setFilter(option.id)} style={[styles.orderFilter, { borderColor: filter === option.id ? theme.accent : theme.lineColor, backgroundColor: filter === option.id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === option.id ? theme.accentInk : theme.ink }]}>{option.label === "Packed" && madeByUvel ? "Making" : option.label}</Text></Pressable>)}
      </ScrollView>
      {filtered.length ? filtered.map((order) => <OrderCard key={order.id} order={order} madeByUvel={Boolean(madeByUvel || order.madeByUvel)} manager={manager} reviewer={reviewer} theme={theme} styles={styles} />) : <Empty text={orders.length ? "No orders match this filter." : "No brand orders yet."} theme={theme} styles={styles} />}
    </View>
  );
}

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  unfulfilled: "To process",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
  returned: "Returned",
};

function fulfillmentLabel(status: FulfillmentStatus, made?: boolean) {
  if (made && (status === "unfulfilled" || status === "processing" || status === "packed")) return "Making";
  if (made && status === "shipped") return "Shipped";
  return FULFILLMENT_LABELS[status];
}

function nextFulfillment(status: FulfillmentStatus, made?: boolean): FulfillmentStatus | null {
  if (made) {
    if (status === "unfulfilled" || status === "processing" || status === "packed") return "shipped";
    if (status === "shipped") return "delivered";
    return null;
  }
  if (status === "unfulfilled") return "processing";
  if (status === "processing") return "packed";
  if (status === "packed") return "shipped";
  if (status === "shipped") return "delivered";
  return null;
}

function OrderCard({ order, madeByUvel, manager, reviewer, theme, styles }: { order: Order; madeByUvel?: boolean; manager: boolean; reviewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const fulfillment = order.fulfillmentStatus || (order.status === "paid" ? "unfulfilled" : "canceled");
  const [expanded, setExpanded] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [trackingUrl, setTrackingUrl] = useState(order.shipment?.trackingUrl || "");
  const [exceptionNote, setExceptionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const made = Boolean(madeByUvel || order.madeByUvel);
  const next = nextFulfillment(fulfillment, made);
  const shipment = order.shipment;
  const shipmentStatus = shipment?.status || (order.trackingNumber ? "in_transit" : "label_pending");
  const buyer = order.address?.name || "Buyer";
  const resolution = order.resolution;
  const resolutionLabel = resolution ? `${resolution.type === "return" ? "Return" : "Cancellation"} · ${resolution.status.replace("_", " ")}` : "";

  async function advance() {
    if (!manager || !next) return;
    if (next === "shipped" && !made && !tracking.trim()) {
      Alert.alert("Tracking required", "Add a carrier and tracking number before marking this order shipped.");
      setExpanded(true);
      return;
    }
    setBusy(true);
    try {
      if (next === "shipped" && !made) {
        await createOrderShipment(order.id, { carrier: carrier.trim(), trackingNumber: tracking.trim(), trackingUrl: trackingUrl.trim() || undefined });
      } else if (next === "delivered" && shipment) {
        await updateOrderShipment(order.id, "delivered");
      } else {
        await updateOrderFulfillment(order.id, { fulfillmentStatus: next, carrier: carrier.trim(), trackingNumber: tracking.trim() });
      }
    } catch (error) {
      Alert.alert("Order update", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setBusy(false);
    }
  }

  async function reportException(code: ShippingExceptionCode) {
    if (!manager || !shipment || busy) return;
    const note = exceptionNote.trim() || `Brand HQ reported a ${code.replace("_", " ")} exception.`;
    setBusy(true);
    try {
      await updateOrderShipment(order.id, "exception", { exceptionCode: code, note });
      setExceptionNote("");
    } catch (error) {
      Alert.alert("Shipment exception", error instanceof Error ? error.message : "Could not record this exception.");
    } finally {
      setBusy(false);
    }
  }

  function chooseException() {
    const options: Array<[ShippingExceptionCode, string]> = [["address_issue", "Address issue"], ["carrier_delay", "Carrier delay"], ["damaged", "Damaged in transit"], ["lost", "Lost shipment"], ["recipient_unavailable", "Recipient unavailable"], ["customs", "Customs hold"], ["other", "Other"]];
    Alert.alert("Report delivery exception", "Choose the issue affecting this shipment.", [...options.map(([code, label]) => ({ text: label, onPress: () => void reportException(code) })), { text: "Cancel", style: "cancel" as const }]);
  }

  async function review(decision: "approve" | "reject" | "mark_received" | "confirm_restock" | "skip_restock") {
    if (!reviewer || !resolution || busy) return;
    setBusy(true);
    try {
      await reviewOrderResolution(order.id, decision);
    } catch (error) {
      Alert.alert("Resolution update", error instanceof Error ? error.message : "Could not update this resolution.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.orderCard, { backgroundColor: theme.card }]}>
      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.orderHead}>
        {order.piecePhoto ? <Image cachePolicy="memory-disk" source={{ uri: order.piecePhoto }} style={styles.orderImg} contentFit="cover" /> : <View style={[styles.orderImg, { backgroundColor: theme.bg }]} />}
        <View style={styles.orderCopy}>
          <Text style={[styles.orderName, { color: theme.ink }]} numberOfLines={2}>{order.pieceName}</Text>
          <Text style={[styles.orderMeta, { color: theme.muted }]}>{buyer} · {order.country} · {order.delivery}{order.variantLabel || order.variantKey ? ` · Size ${order.variantLabel || order.variantKey}` : ""}</Text>
          <Text style={[styles.orderTotal, { color: theme.ink }]}>{usd(order.totalCents, order.currency)} · {order.status === "paid" ? fulfillmentLabel(fulfillment, made) : "Payment pending"}</Text>
        </View>
        <Text style={[styles.rowArrow, { color: theme.ink }]}>{expanded ? "⌃" : "›"}</Text>
      </Pressable>
      {expanded ? (
        <View style={[styles.orderDetail, { borderTopColor: theme.lineColor }]}>
          <Text style={[styles.orderKicker, { color: theme.muted }]}>ORDER {order.id}</Text>
          <Text style={[styles.detailValue, { color: theme.ink }]}>{order.address?.line1}{order.address?.line2 ? `, ${order.address.line2}` : ""}, {order.address?.city}, {order.address?.region} {order.address?.postal}</Text>
          <Text style={[styles.orderMeta, { color: theme.muted }]}>Payment: {order.status} · Method: {order.payMethod} · {new Date(order.createdAt).toLocaleDateString()}{order.variantLabel || order.variantKey ? ` · Size ${order.variantLabel || order.variantKey}` : ""}</Text>
          {shipment ? <View style={[styles.shipmentBox, { borderColor: theme.lineColor }]}><Text style={[styles.orderKicker, { color: theme.muted }]}>SHIPMENT · {shipmentStatus.replace("_", " ")}</Text><Text style={[styles.orderMeta, { color: theme.ink }]}>{shipment.carrier} · {shipment.trackingNumber}</Text>{shipment.trackingUrl ? <Pressable onPress={() => void Linking.openURL(shipment.trackingUrl || "")}><Text style={[styles.trackingLink, { color: theme.accent }]}>Open carrier tracking ↗</Text></Pressable> : null}{shipment.lastLocation ? <Text style={[styles.orderMeta, { color: theme.muted }]}>Last location: {shipment.lastLocation}</Text> : null}{shipment.status === "exception" ? <Text style={[styles.exceptionText, { color: theme.accent }]}>Exception: {shipment.exceptionCode?.replace("_", " ") || "Delivery issue"}{shipment.exceptionNote ? ` · ${shipment.exceptionNote}` : ""}</Text> : null}{manager && shipment.status !== "delivered" && shipment.status !== "returned" && shipment.status !== "exception" ? <><TextInput value={exceptionNote} onChangeText={setExceptionNote} placeholder="Optional exception note" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} /><Pressable disabled={busy} onPress={chooseException} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Report delivery exception</Text></Pressable></> : null}</View> : order.trackingNumber ? <Text style={[styles.orderMeta, { color: theme.muted }]}>Tracking: {order.carrier || "Carrier"} · {order.trackingNumber}</Text> : null}
          {resolution ? <View style={[styles.resolutionBox, { borderColor: theme.lineColor }]}><Text style={[styles.orderKicker, { color: theme.muted }]}>{resolutionLabel}</Text><Text style={[styles.orderMeta, { color: theme.muted }]}>Reason: {resolution.reason.replace("_", " ")}{resolution.note ? ` · ${resolution.note}` : ""}</Text>{reviewer && resolution.status === "requested" ? <View style={styles.orderActions}><Pressable disabled={busy} onPress={() => void review("reject")} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Reject</Text></Pressable><Pressable disabled={busy} onPress={() => void review("approve")} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>Approve</Text></Pressable></View> : null}{reviewer && resolution.type === "return" && resolution.status === "item_sent" ? <View style={styles.orderActions}><Pressable disabled={busy} onPress={() => void review("reject")} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Reject</Text></Pressable><Pressable disabled={busy} onPress={() => void review("mark_received")} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>Mark received</Text></Pressable></View> : null}{reviewer && resolution.type === "return" && resolution.status === "received" ? <View style={styles.orderActions}><Pressable disabled={busy} onPress={() => void review("skip_restock")} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Do not restock</Text></Pressable><Pressable disabled={busy} onPress={() => void review("confirm_restock")} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>Restock item</Text></Pressable></View> : null}</View> : null}
          {made ? <Text style={[styles.orderMeta, { color: theme.muted, marginTop: 8 }]}>Uvel is making this. The manufacturer sends it. Delivery is already paid.</Text> : null}
          {manager && order.status === "paid" && next ? (
            <>
              {made && next === "shipped" ? null : (
                <>
                  <TextInput value={carrier} onChangeText={setCarrier} placeholder="Carrier" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} />
                  <TextInput value={tracking} onChangeText={setTracking} placeholder="Tracking number (required before shipping)" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} autoCapitalize="characters" />
                  <TextInput value={trackingUrl} onChangeText={setTrackingUrl} placeholder="Carrier tracking URL (optional)" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} autoCapitalize="none" keyboardType="url" />
                </>
              )}
              <View style={styles.orderActions}>
                <Pressable disabled={busy} onPress={() => void advance()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Saving…" : made && next === "shipped" ? "Manufacturer shipped" : fulfillmentLabel(next, made)}</Text></Pressable>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TeamSection({ brand, manager, theme, styles, onRole }: { brand: Brand; manager: boolean; theme: HQTheme; styles: ReturnType<typeof make>; onRole: (member: BrandMember) => void }) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Team & access</Text>
          <Text style={[styles.sectionP, { color: theme.muted }]}>Give every collaborator the access their job requires.</Text>
        </View>
        {manager ? <Pressable onPress={() => router.push({ pathname: "/brand/invite", params: { id: brand.id } })} style={[styles.smallCta, { backgroundColor: theme.accent }]}><Text style={[styles.smallCtaTxt, { color: theme.accentInk }]}>Invite</Text></Pressable> : null}
      </View>
      <View style={[styles.memberCard, { backgroundColor: theme.card }]}>
        {brand.members.map((member) => (
          <Pressable key={member.uid} onPress={() => onRole(member)} style={[styles.memberRow, { borderBottomColor: theme.lineColor }]}>
            <View style={styles.memberAvatar}><Text style={[styles.memberAvatarTxt, { color: theme.ink }]}>{(member.name[0] || "U").toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memberName, { color: theme.ink }]}>{member.name}</Text>
              <Text style={[styles.memberMeta, { color: theme.muted }]}>{memberRoleLabel(member.role)}{inquiryRecipients(brand).includes(member.uid) ? " · Receives inquiries" : ""}</Text>
            </View>
            {manager && member.role !== "owner" ? <Text style={[styles.manageTxt, { color: theme.accent }]}>Change</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GrowthToolsSection({ brand, uid, orders, pieces, viewer, theme, styles, onSection }: { brand: Brand; uid: string; orders: Order[]; pieces: ClosetPiece[]; viewer: boolean; theme: HQTheme; styles: ReturnType<typeof make>; onSection: (section: Section) => void }) {
  const liveListings = pieces.filter((piece) => piece.status === "listed");
  const lowStock = liveListings.filter((piece) => typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10);
  const paidOrders = orders.filter((order) => order.status === "paid").length;
  const pageReady = Boolean(brand.logoUri && ((brand.tagline || "").trim() || (brand.story || "").trim()));
  const canEditPage = canStudio(brand, uid);
  const canAddProduct = canManageCatalog(brand, uid);
  const completedCount = Number(pageReady) + Number(liveListings.length > 0);
  const shareBrand = () => void Share.share({ title: `${brand.name} on Uvel`, message: `${brand.name} on Uvel  uvel://brand/${brand.id}` });
  const primary = !pageReady
    ? { title: "Finish your brand page", detail: "Add your logo and a short story so shoppers know who you are.", button: canEditPage ? "Edit page" : "Owner only", onPress: canEditPage ? () => router.push({ pathname: "/brand/studio", params: { id: brand.id } }) : undefined }
    : !liveListings.length
      ? { title: "Add your first product", detail: "Give shoppers something real to discover.", button: canAddProduct ? "Add product" : "Manager only", onPress: canAddProduct ? () => router.push({ pathname: "/brand/list", params: { id: brand.id } }) : undefined }
      : { title: "Share your brand", detail: "Send your brand page to people who might love it.", button: "Share brand", onPress: shareBrand };
  const steps = [
    { id: "page", title: "Finish your brand page", detail: "Logo and story", done: pageReady, onPress: canEditPage ? () => router.push({ pathname: "/brand/studio", params: { id: brand.id } }) : undefined },
    { id: "product", title: "Add your first product", detail: liveListings.length ? `${liveListings.length} live product${liveListings.length === 1 ? "" : "s"}` : "Nothing live yet", done: liveListings.length > 0, onPress: canAddProduct ? () => router.push({ pathname: "/brand/list", params: { id: brand.id } }) : undefined },
    { id: "share", title: "Share your brand", detail: paidOrders ? `${paidOrders} paid order${paidOrders === 1 ? "" : "s"} so far` : "Help the right people find you", done: false, onPress: shareBrand },
  ];

  return (
    <View>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Next steps</Text>
          <Text style={[styles.sectionP, { color: theme.muted }]}>A simple path to get your brand ready and keep it moving.</Text>
        </View>
      </View>
      <View style={[styles.growthHero, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>
        <Text style={[styles.growthEyebrow, { color: theme.accent }]}>YOUR BRAND PLAN</Text>
        <Text style={[styles.growthHeroTitle, { color: theme.ink }]}>{completedCount === 2 ? "Your brand is ready to grow" : `${completedCount} of 2 steps complete`}</Text>
        <Text style={[styles.growthHeroCopy, { color: theme.muted }]}>{completedCount === 2 ? "Keep sharing your brand and watch what shoppers respond to." : "Complete these basics so shoppers can find you and understand what you make."}</Text>
        <View style={[styles.growthProgressTrack, { backgroundColor: theme.lineColor }]}><View style={[styles.growthProgressFill, { width: `${(completedCount / 2) * 100}%`, backgroundColor: theme.accent }]} /></View>
      </View>
      <View style={[styles.growthPrimary, { backgroundColor: theme.accent }]}>
        <Text style={[styles.growthPrimaryLabel, { color: theme.accentInk }]}>YOUR NEXT STEP</Text>
        <Text style={[styles.growthPrimaryTitle, { color: theme.accentInk }]}>{primary.title}</Text>
        <Text style={[styles.growthPrimaryCopy, { color: theme.accentInk }]}>{primary.detail}</Text>
        <Pressable disabled={!primary.onPress} onPress={primary.onPress} style={[styles.growthPrimaryButton, { backgroundColor: theme.accentInk }, !primary.onPress && { opacity: 0.55 }]}><Text style={[styles.growthPrimaryButtonText, { color: theme.accent }]}>{primary.button}</Text></Pressable>
      </View>
      <Text style={[styles.financeHeading, { color: theme.ink }]}>Keep things moving</Text>
      <View style={[styles.growthChecklist, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>
        {steps.map((step, index) => (
          <View key={step.id} style={[styles.growthStep, index < steps.length - 1 && { borderBottomColor: theme.lineColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.growthStepIcon, { backgroundColor: step.done ? theme.accent : theme.bg }]}><Text style={[styles.growthStepIconText, { color: step.done ? theme.accentInk : theme.muted }]}>{step.done ? "✓" : String(index + 1)}</Text></View>
            <View style={{ flex: 1 }}><Text style={[styles.growthStepTitle, { color: theme.ink }]}>{step.title}</Text><Text style={[styles.growthStepCopy, { color: theme.muted }]}>{step.detail}</Text></View>
            {step.onPress ? <Pressable onPress={step.onPress} style={[styles.growthStepAction, { borderColor: theme.lineColor }]}><Text style={[styles.growthStepActionText, { color: theme.ink }]}>{step.done ? "View" : "Open"}</Text></Pressable> : null}
          </View>
        ))}
      </View>
      {lowStock.length ? <Pressable onPress={() => onSection("catalog")} style={[styles.growthNotice, { borderColor: theme.lineColor }]}><Text style={[styles.growthNoticeTitle, { color: theme.ink }]}>You have {lowStock.length} low-stock product{lowStock.length === 1 ? "" : "s"}</Text><Text style={[styles.growthNoticeCopy, { color: theme.muted }]}>Review your catalog before shoppers find an item that may sell out.</Text><Text style={[styles.growthNoticeAction, { color: theme.accent }]}>Review catalog ›</Text></Pressable> : null}
      {viewer ? <Pressable onPress={() => onSection("analytics")} style={[styles.growthAnalyticsLink, { borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.growthStepTitle, { color: theme.ink }]}>See how people are responding</Text><Text style={[styles.growthStepCopy, { color: theme.muted }]}>Open Analytics when you want the detail.</Text></View><Text style={[styles.growthNoticeAction, { color: theme.accent }]}>Analytics ›</Text></Pressable> : null}
    </View>
  );
}

function AdvancedAnalyticsSection({ brand, orders, pieces, marketing, viewer, theme, styles }: { brand: Brand; orders: Order[]; pieces: ClosetPiece[]; marketing: MarketingState; viewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const currency = getMarket(brand.country).currency;
  const [remote, setRemote] = useState<Awaited<ReturnType<typeof readBrandAnalytics>>>(null);
  const [source, setSource] = useState<AnalyticsDisplayState>("loading");
  const [tab, setTab] = useState<"overview" | "products" | "channels">("overview");
  const attributionReport = useCampaignAttributionReport(brand.id);
  const attribution = attributionReport.rows;
  const attributionState = attributionReport.state as AnalyticsDisplayState;
  const channelReports = useMemo(() => summarizeCampaignAttributionByChannel(attribution, (row) => marketing.campaigns.find((item) => item.id === row.campaignId)?.channel), [attribution, marketing.campaigns]);
  const local = useMemo(() => buildGrowthSnapshot(brand.id, orders, pieces, currency, marketing.collections, marketing.campaigns, marketing.promotions), [brand.id, orders, pieces, currency, marketing]);

  useEffect(() => {
    let alive = true;
    setSource("loading");
    void readBrandAnalytics(brand.id, currency)
      .then((data) => { if (!alive) return; setRemote(data); setSource(analyticsDisplayState(false, data)); })
      .catch(() => { if (alive) { setRemote(null); setSource("unavailable"); } });
    return () => { alive = false; };
  }, [brand.id, currency]);

  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Advanced analytics</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Analytics are restricted to the owner unless the brand shares them with the team.</Text></View>;

  const confirmed = source === "confirmed";
  const confirmedProducts = remote?.top || [];
  const primaryRecommendation = local.recommendations[0];
  const insightCopy = source === "loading" ? "Checking confirmed activity…" : source === "unavailable" ? "Analytics will appear when the brand analytics service is connected." : source === "no_activity" ? "There is not enough confirmed activity for a recommendation yet." : primaryRecommendation?.detail || "Keep learning from confirmed activity as shoppers discover your brand.";
  const insightTitle = source === "confirmed" && primaryRecommendation ? primaryRecommendation.title : "What needs attention";

  return (
    <View>
      <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Analytics</Text><Text style={[styles.sectionP, { color: theme.muted }]}>See what is working for {brand.name}, based on confirmed activity.</Text></View></View>
      <View style={[styles.analyticsSource, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>
        <View style={[styles.analyticsDot, { backgroundColor: confirmed ? theme.accent : theme.muted }]} />
        <Text style={[styles.analyticsSourceText, { color: theme.muted }]}>{analyticsDisclosure(source)}</Text>
      </View>
      <View style={styles.analyticsTabs}>{([['overview', 'Overview'], ['products', 'Products'], ['channels', 'Channels']] as const).map(([id, label]) => <Pressable key={id} onPress={() => setTab(id)} style={[styles.analyticsTab, { borderColor: tab === id ? theme.accent : theme.lineColor, backgroundColor: tab === id ? theme.accent : theme.card }]}><Text style={[styles.analyticsTabText, { color: tab === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}</View>
      {tab === "overview" ? <>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Performance</Text>
        <View style={styles.financeStats}><FinanceStat label="Net sales" value={analyticsCurrencyValue(remote?.earningsCents, source, (cents) => usd(cents, currency))} theme={theme} styles={styles} /><FinanceStat label="Items sold" value={analyticsValue(remote?.sold, source)} theme={theme} styles={styles} /><FinanceStat label="Conversion" value={source === "loading" ? "Loading…" : source === "unavailable" ? "Unavailable" : source === "no_activity" ? "No activity yet" : `${remote?.conversion || 0}%`} theme={theme} styles={styles} /></View>
        <View style={[styles.analyticsSecondary, { borderColor: theme.lineColor }]}><Text style={[styles.analyticsSecondaryText, { color: theme.muted }]}>Views <Text style={{ color: theme.ink }}>{confirmed ? formatAnalyticsCount(remote?.views || 0) : analyticsValue(remote?.views, source)}</Text></Text><Text style={[styles.analyticsSecondaryText, { color: theme.muted }]}>Likes <Text style={{ color: theme.ink }}>{confirmed ? formatAnalyticsCount(remote?.likes || 0) : analyticsValue(remote?.likes, source)}</Text></Text><Text style={[styles.analyticsSecondaryText, { color: theme.muted }]}>Followers <Text style={{ color: theme.ink }}>{confirmed ? formatAnalyticsCount(remote?.follows || 0) : analyticsValue(remote?.follows, source)}</Text></Text></View>
        <View style={[styles.analyticsInsight, { backgroundColor: theme.card, borderColor: primaryRecommendation?.tone === "warning" ? theme.accent : theme.lineColor }]}><Text style={[styles.analyticsInsightLabel, { color: theme.accent }]}>WHAT NEEDS ATTENTION</Text><Text style={[styles.analyticsInsightTitle, { color: theme.ink }]}>{insightTitle}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{insightCopy}</Text></View>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Catalog health</Text><View style={[styles.analyticsPanel, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeLine, { color: theme.muted }]}>Live products <Text style={{ color: theme.ink }}>{local.liveListings}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Available units <Text style={{ color: theme.ink }}>{local.totalAvailableUnits}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Low-stock products <Text style={{ color: theme.ink }}>{local.lowStockListings}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Repeat buyers <Text style={{ color: theme.ink }}>{confirmed ? analyticsValue(local.returningBuyers, source, "None yet") : source === "loading" ? "Loading…" : "Unavailable"}</Text></Text></View>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Top products</Text>{confirmedProducts.length ? confirmedProducts.slice(0, 3).map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: "/closet/[id]", params: { id: item.id } })} style={[styles.analyticsProduct, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{item.photo ? <Image cachePolicy="memory-disk" source={{ uri: item.photo }} style={styles.analyticsProductImg} contentFit="cover" /> : <View style={[styles.analyticsProductImg, { backgroundColor: theme.bg }]} />}<View style={{ flex: 1 }}><Text style={[styles.marketingCardTitle, { color: theme.ink }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{item.sold} sold · {item.views} views</Text></View><Text style={[styles.rowArrow, { color: theme.muted }]}>›</Text></Pressable>) : <Empty text={source === "loading" ? "Checking product activity…" : source === "unavailable" ? "Product activity is unavailable right now." : "No confirmed product activity yet."} theme={theme} styles={styles} />}
      </> : null}
      {tab === "products" ? <>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Product performance</Text><Text style={[styles.sectionP, { color: theme.muted }]}>See which live products are getting attention and turning it into sales.</Text>
        {confirmedProducts.length ? confirmedProducts.slice(0, 8).map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: "/closet/[id]", params: { id: item.id } })} style={[styles.analyticsProduct, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{item.photo ? <Image cachePolicy="memory-disk" source={{ uri: item.photo }} style={styles.analyticsProductImg} contentFit="cover" /> : <View style={[styles.analyticsProductImg, { backgroundColor: theme.bg }]} />}<View style={{ flex: 1 }}><Text style={[styles.marketingCardTitle, { color: theme.ink }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{item.sold} sold · {item.views} views · {item.likes} likes</Text></View><Text style={[styles.rowArrow, { color: theme.muted }]}>›</Text></Pressable>) : <Empty text={source === "loading" ? "Checking product activity…" : source === "unavailable" ? "Product analytics are unavailable right now." : "No confirmed product activity yet."} theme={theme} styles={styles} />}
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Catalog health</Text><View style={[styles.analyticsPanel, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeLine, { color: theme.muted }]}>Live products <Text style={{ color: theme.ink }}>{local.liveListings}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Low-stock products <Text style={{ color: theme.ink }}>{local.lowStockListings}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Available units <Text style={{ color: theme.ink }}>{local.totalAvailableUnits}</Text></Text></View>
      </> : null}
      {tab === "channels" ? <>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Where shoppers found you</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Confirmed activity from Brand Page, Shop, and Today. Purchases and revenue appear only after trusted payment confirmation.</Text>
        <View style={[styles.analyticsPanel, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{channelReports.map((report) => { const hasActivity = report.impressions + report.engagements + report.checkoutStarted + report.purchases + Object.values(report.revenueByCurrency).reduce((sum, value) => sum + value, 0) > 0; const conversion = report.impressions > 0 && report.purchases > 0 ? `${Math.round((report.purchases / report.impressions) * 1000) / 10}%` : report.purchases > 0 ? "Unavailable" : "No confirmed purchases"; const revenue = Object.entries(report.revenueByCurrency).filter(([, value]) => value > 0).map(([code, value]) => usd(value, code)).join(" · ") || "No confirmed revenue"; return <View key={report.channel} style={[styles.channelReportRow, { borderBottomColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.channelReportName, { color: theme.ink }]}>{channelLabel(report.channel)}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{hasActivity ? `${report.impressions} impressions · ${report.engagements} engagements · ${report.checkoutStarted} checkouts` : attributionState === "loading" ? "Loading confirmed activity…" : attributionState === "unavailable" ? "Unavailable" : "No confirmed activity yet"}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{hasActivity ? `${report.purchases} purchases · ${conversion}` : "No confirmed purchases"}</Text></View><Text style={[styles.financeRowAmount, { color: theme.ink }]}>{attributionState === "loading" ? "Loading…" : attributionState === "unavailable" ? "Unavailable" : revenue}</Text></View>; })}</View>
        <Text style={[styles.analyticsSubheading, { color: theme.ink }]}>Campaigns</Text>{attribution.length ? attribution.slice(0, 8).map((row) => { const campaign = marketing.campaigns.find((item) => item.id === row.campaignId); const channel = row.channel || campaign?.channel; const rowHasActivity = row.impressions + row.engagements + row.checkoutStarted + row.purchases + row.revenueCents > 0; return <View key={row.id} style={[styles.analyticsCampaign, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.marketingCardTitle, { color: theme.ink }]} numberOfLines={1}>{campaign?.name || row.campaignId}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{channel ? channelLabel(channel) : "Campaign channel unavailable"}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{rowHasActivity ? `${row.impressions} impressions · ${row.engagements} engagements · ${row.checkoutStarted} checkouts` : "No confirmed activity yet"}</Text></View><Text style={[styles.financeRowAmount, { color: theme.ink }]}>{row.purchases ? usd(row.revenueCents, row.currency || currency) : "No confirmed revenue"}</Text></View>; }) : <Empty text={attributionState === "loading" ? "Checking campaign activity…" : attributionState === "unavailable" ? "Campaign activity is unavailable right now." : "No campaign activity yet."} theme={theme} styles={styles} />}
      </> : null}
    </View>
  );
}

function formatAnalyticsCount(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(value); }
function channelLabel(channel: "brand_page" | "shop" | "today") { return channel === "brand_page" ? "Brand Page" : channel === "shop" ? "Shop" : "Today"; }

function MarketingSection({ brand, pieces, state, viewer, manager, theme, colors, styles, initialTab = "collections", onFocus }: { brand: Brand; pieces: ClosetPiece[]; state: MarketingState; viewer: boolean; manager: boolean; theme: HQTheme; colors: Colors; styles: ReturnType<typeof make>; initialTab?: "collections" | "campaigns" | "promotions"; onFocus: () => void }) {
  const [tab, setTab] = useState<"collections" | "campaigns" | "promotions">(initialTab);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignHeadline, setCampaignHeadline] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [campaignChannel, setCampaignChannel] = useState<BrandCampaign["channel"]>("brand_page");
  const [campaignCollectionId, setCampaignCollectionId] = useState("");
  const [campaignPromotionId, setCampaignPromotionId] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | undefined>();
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionKind, setPromotionKind] = useState<BrandPromotion["kind"]>("percentage");
  const [promotionValue, setPromotionValue] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("");
  const [promotionUsageLimit, setPromotionUsageLimit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [launchStatus, setLaunchStatus] = useState<MarketingStatus>("draft");
  const [busy, setBusy] = useState(false);
  const listed = pieces.filter((piece) => piece.status === "listed");
  const parseDate = (value: string) => { const time = Date.parse(value); return Number.isFinite(time) ? time : undefined; };
  const scheduledTimes = () => { const startAt = parseDate(startDate); const endAt = parseDate(endDate); if (startAt && endAt && endAt <= startAt) throw new Error("End date must be after the start date."); return { startAt, endAt }; };
  const selectProduct = (id: string) => setSelectedProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const resetForm = () => { setCollectionName(""); setCollectionDescription(""); setCampaignName(""); setCampaignHeadline(""); setCampaignBody(""); setCampaignCollectionId(""); setCampaignPromotionId(""); setEditingCampaignId(undefined); setPromotionCode(""); setPromotionValue(""); setMinimumOrder(""); setPromotionUsageLimit(""); setStartDate(""); setEndDate(""); setSelectedProductIds([]); setLaunchStatus("draft"); };
  const statusForSave = (startAt?: number) => launchStatus === "live" && startAt && startAt > Date.now() ? "scheduled" : launchStatus;
  const editCampaign = (item: BrandCampaign, duplicate = false) => {
    setTab("campaigns");
    setEditingCampaignId(duplicate ? undefined : item.id);
    setCampaignName(duplicate ? `${item.name} copy` : item.name);
    setCampaignHeadline(item.headline);
    setCampaignBody(item.body);
    setCampaignChannel(item.channel);
    setCampaignCollectionId(item.collectionId || "");
    setCampaignPromotionId(item.promotionId || "");
    setSelectedProductIds([...item.productIds]);
    setStartDate(duplicate ? "" : item.startAt ? new Date(item.startAt).toISOString().slice(0, 10) : "");
    setEndDate(duplicate ? "" : item.endAt ? new Date(item.endAt).toISOString().slice(0, 10) : "");
    setLaunchStatus(duplicate ? "draft" : item.status === "scheduled" ? "live" : item.status);
  };
  const campaignWarnings = (item: BrandCampaign) => {
    const warnings: string[] = [];
    const available = new Set(listed.map((piece) => piece.id));
    if (!item.productIds.length) warnings.push("Add at least one listing.");
    if (item.productIds.some((id) => !available.has(id))) warnings.push("One or more listings are no longer live.");
    if (item.collectionId && !state.collections.some((collection) => collection.id === item.collectionId)) warnings.push("Linked collection is unavailable.");
    const promotion = item.promotionId ? state.promotions.find((row) => row.id === item.promotionId) : undefined;
    if (item.promotionId && !promotion) warnings.push("Linked promotion is unavailable.");
    if (promotion && promotion.status !== "live") warnings.push("Linked promotion is not live.");
    if (item.startAt && item.endAt && item.endAt <= item.startAt) warnings.push("Launch window is invalid.");
    if (item.status === "live" && item.startAt && item.startAt > Date.now()) warnings.push("Campaign is scheduled for a future date.");
    if (item.status === "live" && item.endAt && item.endAt < Date.now()) warnings.push("Campaign end date has passed.");
    return warnings;
  };

  async function save() {
    if (!manager || busy) return;
    setBusy(true);
    try {
      const times = scheduledTimes();
      if (tab === "collections") {
        await saveBrandCollection({ brandId: brand.id, name: collectionName, description: collectionDescription, productIds: selectedProductIds, coverProductId: selectedProductIds[0] || "", status: statusForSave(times.startAt), ...times });
      } else if (tab === "campaigns") {
        await saveBrandCampaign({ id: editingCampaignId, brandId: brand.id, name: campaignName, headline: campaignHeadline, body: campaignBody, channel: campaignChannel, collectionId: campaignCollectionId || undefined, promotionId: campaignPromotionId || undefined, productIds: selectedProductIds, status: statusForSave(times.startAt), ...times });
      } else {
        await saveBrandPromotion({ brandId: brand.id, code: promotionCode, kind: promotionKind, value: Number(promotionValue), currency: getMarket(brand.country).currency, minimumOrderCents: Math.round(Number(minimumOrder) * 100) || 0, usageLimit: promotionUsageLimit ? Math.max(1, Math.floor(Number(promotionUsageLimit))) : undefined, status: statusForSave(times.startAt), ...times });
      }
      resetForm();
      Alert.alert("Saved", tab === "collections" ? "Collection saved to the brand workspace." : tab === "campaigns" ? editingCampaignId ? "Campaign changes saved." : "Campaign saved with its launch timing." : "Promotion saved to the brand workspace.");
    } catch (error) {
      Alert.alert("Marketing", error instanceof Error ? error.message : "Could not save this marketing item.");
    } finally { setBusy(false); }
  }

  async function toggleStatus(item: BrandCollection | BrandCampaign | BrandPromotion) {
    if (!manager || busy) return;
    setBusy(true);
    try {
      const status: MarketingStatus = item.status === "live" ? "paused" : "live";
      if ("headline" in item) await saveBrandCampaign({ ...item, status });
      else if ("code" in item) await saveBrandPromotion({ ...item, status });
      else await saveBrandCollection({ ...item, status });
    } catch (error) { Alert.alert("Marketing", error instanceof Error ? error.message : "Could not update status."); } finally { setBusy(false); }
  }

  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Merchandising & marketing</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Marketing data is restricted to owners, admins, marketing members, and viewers.</Text></View>;
  return <View><View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Merchandising & marketing</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Choose the placement, offer, products, timing, and status.</Text></View></View><View style={styles.marketingStats}><Stat label="Collections" value={String(state.collections.length)} theme={theme} styles={styles} /><Stat label="Campaigns" value={String(state.campaigns.length)} theme={theme} styles={styles} /><Stat label="Live" value={String([...state.collections, ...state.campaigns, ...state.promotions].filter((item) => item.status === "live").length)} theme={theme} styles={styles} /></View><ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>{([["collections", "Collections"], ["campaigns", "Campaigns"]] as const).map(([id, label]) => <Pressable key={id} onPress={() => { setTab(id); resetForm(); }} style={[styles.orderFilter, { borderColor: tab === id ? theme.accent : theme.lineColor, backgroundColor: tab === id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: tab === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}</ScrollView>{manager ? <View style={[styles.marketingComposer, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>{tab === "collections" ? "Create a collection" : tab === "campaigns" ? editingCampaignId ? "Edit campaign" : "Create a campaign" : "Create a promotion"}</Text>{tab === "collections" ? <><TextInput value={collectionName} onChangeText={setCollectionName} placeholder="Collection name" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={collectionDescription} onChangeText={setCollectionDescription} placeholder="Description for buyers" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /></> : tab === "campaigns" ? <><TextInput value={campaignName} onChangeText={setCampaignName} placeholder="Campaign name" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={campaignHeadline} onChangeText={setCampaignHeadline} placeholder="Headline" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={campaignBody} onChangeText={setCampaignBody} placeholder="Campaign message" placeholderTextColor={theme.muted} multiline onFocus={onFocus} style={[styles.marketingInput, styles.marketingBody, { color: theme.ink, borderColor: theme.lineColor }]} /><MarketingChoice label="Channel" choices={[["brand_page", "Brand page"], ["shop", "Shop"], ["today", "Today"]]} value={campaignChannel} onChange={(value) => setCampaignChannel(value as BrandCampaign["channel"])} theme={theme} styles={styles} /><MarketingChoice label="Collection" choices={[["", "No collection"], ...state.collections.map((collection) => [collection.id, collection.name] as const)]} value={campaignCollectionId} onChange={(value) => { setCampaignCollectionId(value); const collection = state.collections.find((item) => item.id === value); if (collection) setSelectedProductIds(collection.productIds.filter((id) => listed.some((piece) => piece.id === id))); }} theme={theme} styles={styles} /><MarketingChoice label="Promotion" choices={[["", "No promotion"], ...state.promotions.map((promotion) => [promotion.id, promotion.code] as const)]} value={campaignPromotionId} onChange={setCampaignPromotionId} theme={theme} styles={styles} /></> : <><TextInput value={promotionCode} onChangeText={setPromotionCode} placeholder="Promotion code · e.g. APION10" placeholderTextColor={theme.muted} autoCapitalize="characters" onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><MarketingChoice label="Discount type" choices={[["percentage", "Percentage"], ["fixed", "Fixed amount"]]} value={promotionKind} onChange={(value) => setPromotionKind(value as BrandPromotion["kind"])} theme={theme} styles={styles} /><TextInput value={promotionValue} onChangeText={(value) => setPromotionValue(value.replace(/[^0-9.]/g, ""))} placeholder={promotionKind === "percentage" ? "Discount percent" : "Discount amount"} placeholderTextColor={theme.muted} keyboardType="decimal-pad" onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={minimumOrder} onChangeText={(value) => setMinimumOrder(value.replace(/[^0-9.]/g, ""))} placeholder="Minimum order amount · optional" placeholderTextColor={theme.muted} keyboardType="decimal-pad" onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={promotionUsageLimit} onChangeText={(value) => setPromotionUsageLimit(value.replace(/[^0-9]/g, ""))} placeholder="Usage limit · optional" placeholderTextColor={theme.muted} keyboardType="number-pad" onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /></>}<TextInput value={startDate} onChangeText={setStartDate} placeholder="Start · YYYY-MM-DD (optional)" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={endDate} onChangeText={setEndDate} placeholder="End · YYYY-MM-DD (optional)" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.marketingInput, { color: theme.ink, borderColor: theme.lineColor }]} /><MarketingChoice label="Launch status" choices={[["draft", "Draft"], ["live", "Live"], ["paused", "Paused"], ["ended", "Ended"]]} value={launchStatus === "scheduled" ? "live" : launchStatus} onChange={(value) => setLaunchStatus(value as MarketingStatus)} theme={theme} styles={styles} />{tab === "campaigns" ? <CampaignFocus channel={campaignChannel} collection={state.collections.find((item) => item.id === campaignCollectionId)?.name} promotion={state.promotions.find((item) => item.id === campaignPromotionId)?.code} productCount={selectedProductIds.length} startDate={startDate} endDate={endDate} status={launchStatus} theme={theme} styles={styles} /> : null}{tab !== "promotions" ? <><Text style={[styles.marketingLabel, { color: theme.muted }]}>Listed products</Text><View style={styles.marketingProducts}>{listed.length ? listed.map((piece) => <Pressable key={piece.id} onPress={() => selectProduct(piece.id)} style={[styles.marketingProduct, { borderColor: selectedProductIds.includes(piece.id) ? theme.accent : theme.lineColor, backgroundColor: selectedProductIds.includes(piece.id) ? theme.accent : theme.bg }]}><Text style={[styles.marketingProductTxt, { color: selectedProductIds.includes(piece.id) ? theme.accentInk : theme.ink }]} numberOfLines={1}>{piece.name}</Text></Pressable>) : <Text style={[styles.financeLine, { color: theme.muted }]}>No listed products available.</Text>}</View></> : null}<Pressable disabled={busy} onPress={() => void save()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Saving…" : editingCampaignId ? "Save changes" : `Save ${tab.slice(0, -1)}`}</Text></Pressable></View> : <Text style={[styles.sectionP, { color: theme.muted }]}>Only owners, admins, and marketing members can create or change merchandising items.</Text>}{tab === "collections" ? state.collections.map((item) => <MarketingCard key={item.id} item={item} manager={manager} onToggle={() => void toggleStatus(item)} colors={colors} theme={theme} styles={styles} />) : tab === "campaigns" ? state.campaigns.map((item) => <MarketingCard key={item.id} item={item} manager={manager} onToggle={() => void toggleStatus(item)} onEdit={() => editCampaign(item)} onDuplicate={() => editCampaign(item, true)} onPreview={() => Alert.alert(`${item.name} · ${item.channel.replace("_", " ")}`, `${item.channel.replace("_", " ")} · ${campaignWarnings(item).length ? campaignWarnings(item).join(" ") : "Ready to launch."}`)} warnings={campaignWarnings(item)} colors={colors} theme={theme} styles={styles} />) : state.promotions.map((item) => <MarketingCard key={item.id} item={item} manager={manager} onToggle={() => void toggleStatus(item)} colors={colors} theme={theme} styles={styles} />)}</View>;
}

function CampaignFocus({ channel, collection, promotion, productCount, startDate, endDate, status, theme, styles }: { channel: BrandCampaign["channel"]; collection?: string; promotion?: string; productCount: number; startDate: string; endDate: string; status: MarketingStatus; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const parts = [channel.replace("_", " "), collection || "No collection", promotion || "No promotion", `${productCount} product${productCount === 1 ? "" : "s"}`, startDate || endDate ? `${startDate || "Now"}${endDate ? ` → ${endDate}` : ""}` : "No launch window", status];
  return <View style={[styles.campaignFocus, { borderColor: theme.lineColor }]}><Text style={[styles.campaignFocusLabel, { color: theme.muted }]}>Campaign at a glance</Text><Text style={[styles.campaignFocusText, { color: theme.ink }]}>{parts.join(" · ")}</Text></View>;
}

function MarketingChoice({ label, choices, value, onChange, theme, styles }: { label: string; choices: ReadonlyArray<readonly [string, string]>; value: string; onChange: (value: string) => void; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View><Text style={[styles.marketingLabel, { color: theme.muted }]}>{label}</Text><View style={styles.marketingChoiceRow}>{choices.map(([id, text]) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.marketingChoice, { borderColor: value === id ? theme.accent : theme.lineColor, backgroundColor: value === id ? theme.accent : theme.bg }]}><Text style={[styles.marketingChoiceTxt, { color: value === id ? theme.accentInk : theme.ink }]}>{text}</Text></Pressable>)}</View></View>;
}

function MarketingCard({ item, manager, onToggle, onEdit, onDuplicate, onPreview, warnings = [], colors, theme, styles }: { item: BrandCollection | BrandCampaign | BrandPromotion; manager: boolean; onToggle: () => void; onEdit?: () => void; onDuplicate?: () => void; onPreview?: () => void; warnings?: string[]; colors: Colors; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const title = "code" in item ? item.code : item.name;
  const detail = "code" in item ? `${item.kind === "percentage" ? `${item.value}% off` : `${item.value} fixed discount`} · minimum ${item.minimumOrderCents / 100}${item.usageLimit ? ` · ${item.usageCount || 0}/${item.usageLimit} used` : ""}` : "headline" in item ? `${item.headline} · ${item.channel.replace("_", " ")}` : `${item.productIds.length} products · ${item.description || "No description"}`;
  const timing = item.startAt ? `${new Date(item.startAt).toLocaleDateString()}${item.endAt ? ` → ${new Date(item.endAt).toLocaleDateString()}` : ""}` : "No launch window";
  const campaign = "headline" in item;
  return <View style={[styles.marketingCard, { backgroundColor: theme.card, borderColor: warnings.length ? theme.accent : theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.marketingCardTitle, { color: theme.ink }]}>{title}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{detail}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{timing} · <Text style={{ color: semanticStatus(colors, statusToneFor(item.status)).color, fontWeight: "800" }}>{semanticLabel(item.status)}</Text></Text>{warnings.map((warning) => <Text key={warning} style={[styles.financeLine, { color: semanticStatus(colors, "warning").color }]}>Attention: {warning}</Text>)}</View>{manager ? <View style={styles.marketingActions}>{campaign ? <><Pressable onPress={onPreview} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Preview</Text></Pressable><Pressable onPress={onEdit} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Edit</Text></Pressable><Pressable onPress={onDuplicate} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Duplicate</Text></Pressable></> : null}<Pressable onPress={onToggle} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>{item.status === "live" ? "Pause" : "Make live"}</Text></Pressable></View> : null}</View>;
}

function FinanceSection({ brand, orders, viewer, manager, theme, styles, onPayoutFocus }: { brand: Brand; orders: Order[]; viewer: boolean; manager: boolean; theme: HQTheme; styles: ReturnType<typeof make>; onPayoutFocus: () => void }) {
  const payouts = usePayouts(brand.id);
  const profile = usePayoutProfile(brand.id);
  const ledger = settlementLedger(orders, brand.id);
  const currencies = Array.from(new Set(ledger.map((entry) => entry.currency)));
  const [currency, setCurrency] = useState(currencies[0] || "");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  useEffect(() => {
    if (!currency && currencies[0]) setCurrency(currencies[0]);
    if (currency && !currencies.includes(currency) && currencies.length) setCurrency(currencies[0]);
  }, [currency, currencies.join(",")]);
  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Earnings</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Earnings are restricted to owners, admins, and finance members.</Text></View>;
  const totals = currency ? financeTotals(ledger, payouts, currency) : null;
  const currencyPayouts = currency ? payouts.filter((payout) => payout.currency === currency) : [];

  async function requestPayout() {
    if (!manager || !currency || busy) return;
    const amountCents = Math.round(Number(payoutAmount) * 100);
    if (!totals || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > totals.availableCents) {
      Alert.alert("Payout request", `Enter an amount up to ${usd(totals?.availableCents || 0, currency)}.`);
      return;
    }
    setBusy(true);
    try {
      await requestBrandPayout(brand.id, currency, amountCents);
      setPayoutAmount("");
      Alert.alert("Payout requested", "Your payout request was sent for processing.");
    } catch (error) {
      Alert.alert("Payout request", error instanceof Error ? error.message : "Payout requests are not available yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Earnings</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Here’s what your brand has earned.</Text></View></View>
      {currencies.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>{currencies.map((option) => <Pressable key={option} onPress={() => setCurrency(option)} style={[styles.orderFilter, { borderColor: currency === option ? theme.accent : theme.lineColor, backgroundColor: currency === option ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: currency === option ? theme.accentInk : theme.ink }]}>{option}</Text></Pressable>)}</ScrollView> : null}
      {!totals ? <><View style={[styles.earningsHero, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.earningsEyebrow, { color: theme.muted }]}>AVAILABLE TO YOU</Text><Text style={[styles.earningsHeroValue, { color: theme.ink }]}>—</Text><Text style={[styles.earningsHeroCopy, { color: theme.muted }]}>Your balance will refresh after a customer order is paid and settled</Text></View><PayoutSetup brand={brand} profile={profile} manager={manager} currency={currency || getMarket(brand.country).currency} theme={theme} styles={styles} onFocus={onPayoutFocus} /><Empty text="Your earnings will appear here after your first settled order." theme={theme} styles={styles} /></> : <>
        <View style={[styles.earningsHero, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.earningsEyebrow, { color: theme.muted }]}>AVAILABLE TO YOU · {currency}</Text><Text style={[styles.earningsHeroValue, { color: theme.ink }]}>{usd(totals.availableCents, currency)}</Text><Text style={[styles.earningsHeroCopy, { color: theme.muted }]}>{totals.availableCents > 0 ? "Ready for payout when you are." : "Your balance will refresh after a customer order is paid and settled"}</Text>{manager && totals.availableCents > 0 ? <View style={styles.earningsPayout}><TextInput value={payoutAmount} onChangeText={(value) => setPayoutAmount(value.replace(/[^0-9.]/g, ""))} placeholder={`Amount in ${currency}`} placeholderTextColor={theme.muted} keyboardType="decimal-pad" onFocus={onPayoutFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><Pressable disabled={busy} onPress={() => void requestPayout()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Requesting…" : "Request payout"}</Text></Pressable></View> : null}</View>
        <View style={styles.financeStats}><FinanceStat label="Total earned" value={usd(totals.netCents, currency)} theme={theme} styles={styles} /><FinanceStat label="Pending" value={usd(totals.pendingCents, currency)} theme={theme} styles={styles} /></View>
        <PayoutSetup brand={brand} profile={profile} manager={manager} currency={currency || getMarket(brand.country).currency} theme={theme} styles={styles} onFocus={onPayoutFocus} />
        <Pressable onPress={() => setShowBreakdown((value) => !value)} style={[styles.earningsToggle, { borderColor: theme.lineColor }]}><Text style={[styles.earningsToggleText, { color: theme.ink }]}>{showBreakdown ? "Hide earnings calculation" : "See how earnings are calculated"}</Text><Text style={[styles.earningsToggleArrow, { color: theme.muted }]}>{showBreakdown ? "⌃" : "⌄"}</Text></Pressable>
        {showBreakdown ? <View style={[styles.financeBreakdown, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>Earnings calculation · {currency}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>Gross item sales <Text style={{ color: theme.ink }}>{usd(totals.grossCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Uvel fees <Text style={{ color: theme.ink }}>−{usd(totals.feesCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Refunds <Text style={{ color: theme.ink }}>−{usd(totals.refundsCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Payouts already made <Text style={{ color: theme.ink }}>−{usd(totals.paidOutCents, currency)}</Text></Text></View> : null}
        <Text style={[styles.financeHeading, { color: theme.ink }]}>Recent earnings</Text>{ledger.filter((entry) => entry.currency === currency).map((entry) => <FinanceRow key={entry.id} entry={entry} theme={theme} styles={styles} />)}
        {currencyPayouts.length ? <><Text style={[styles.financeHeading, { color: theme.ink }]}>Payout history</Text>{currencyPayouts.map((payout) => <View key={payout.id} style={[styles.payoutRow, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.financeRowTitle, { color: theme.ink }]}>{usd(payout.amountCents, payout.currency)}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>{new Date(payout.requestedAt).toLocaleDateString()} · {payout.status}{payout.failureReason ? ` · ${payout.failureReason}` : ""}</Text></View><Text style={[styles.payoutStatus, { color: payout.status === "paid" ? theme.accent : theme.muted }]}>{payout.status}</Text></View>)}</> : null}
      </>}
    </View>
  );
}

function PayoutSetup({ brand, profile, manager, currency, theme, styles, onFocus }: { brand: Brand; profile?: import("../../lib/finance").PayoutProfile; manager: boolean; currency: string; theme: HQTheme; styles: ReturnType<typeof make>; onFocus: () => void }) {
  const destinationType: PayoutDestinationType = "bank";
  const [legalName, setLegalName] = useState(profile?.legalName || brand.name);
  const [ownerType, setOwnerType] = useState<PayoutOwnerType>(profile?.ownerType || "individual");
  const [registrationId, setRegistrationId] = useState(profile?.registrationId || brand.registrationId || "");
  const [accountHolderName, setAccountHolderName] = useState(profile?.accountHolderName || "");
  const [institutionName, setInstitutionName] = useState(profile?.institutionName || "");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  useEffect(() => {
    if (!profile) return;
    setLegalName(brand.name);
    setOwnerType(profile.ownerType || "individual");
    setRegistrationId(profile.registrationId || brand.registrationId || "");
    setAccountHolderName(profile.accountHolderName);
    setInstitutionName(profile.institutionName);
  }, [brand.name, profile?.updatedAt]);

  async function save() {
    if (!manager || busy) return;
    setBusy(true);
    try {
      await savePayoutProfile({ brandId: brand.id, ownerType, destinationType, country: brand.country, currency: currency || "USD", legalName, registrationId: ownerType === "business" ? registrationId : "", accountHolderName, institutionName, destination });
      setDestination("");
      Alert.alert("Payout profile submitted", "Your payout destination is saved securely for review. Raw account details are not stored in the app.");
    } catch (error) {
      Alert.alert("Payout setup", error instanceof Error ? error.message : "Could not save payout setup.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = profile?.status === "verified" ? "Verified" : profile?.status === "needs_attention" ? "Needs attention" : profile?.status === "submitted" ? "Submitted for review" : "Not set up";
  return <View style={[styles.payoutSetup, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={styles.payoutSetupHead}><View style={{ flex: 1 }}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>Payout account</Text><Text style={[styles.financeLine, { color: theme.muted }]}>{profile?.destinationLast4 ? `Bank ending in ${profile.destinationLast4}` : "Add an account when you are ready to receive payouts."}</Text></View><Text style={[styles.payoutStatus, { color: profile?.status === "verified" ? theme.accent : theme.muted }]}>{statusLabel}</Text></View>{manager ? <Pressable onPress={() => setShowSetup((value) => !value)} style={[styles.payoutManageButton, { borderColor: theme.lineColor }]}><Text style={[styles.payoutManageText, { color: theme.ink }]}>{showSetup ? "Close" : profile ? "Manage payout account" : "Set up payout account"}</Text><Text style={[styles.payoutManageArrow, { color: theme.muted }]}>{showSetup ? "⌃" : "›"}</Text></Pressable> : <Text style={[styles.financeLine, { color: theme.muted, marginTop: 9 }]}>Only owners and admins can edit payout setup. Finance members can review its status.</Text>}{showSetup ? <><Text style={[styles.payoutLabel, { color: theme.muted }]}>WITHDRAW AS</Text><View style={styles.payoutTypeRow}><Pressable onPress={() => setOwnerType("individual")} style={[styles.payoutTypeChip, { borderColor: ownerType === "individual" ? theme.accent : theme.lineColor, backgroundColor: ownerType === "individual" ? theme.accent : "transparent" }]}><Text style={[styles.payoutTypeText, { color: ownerType === "individual" ? theme.accentInk : theme.ink }]}>Individual</Text></Pressable><Pressable onPress={() => setOwnerType("business")} style={[styles.payoutTypeChip, { borderColor: ownerType === "business" ? theme.accent : theme.lineColor, backgroundColor: ownerType === "business" ? theme.accent : "transparent" }]}><Text style={[styles.payoutTypeText, { color: ownerType === "business" ? theme.accentInk : theme.ink }]}>Business</Text></Pressable></View><TextInput value={legalName} onChangeText={setLegalName} placeholder={ownerType === "business" ? "Business legal name" : "Full legal name"} placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} />{ownerType === "business" ? <TextInput value={registrationId} onChangeText={setRegistrationId} placeholder="Business registration number" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /> : null}<TextInput value={accountHolderName} onChangeText={setAccountHolderName} placeholder="Account holder name" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={institutionName} onChangeText={setInstitutionName} placeholder="Bank name" placeholderTextColor={theme.muted} onFocus={onFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={destination} onChangeText={(value) => setDestination(value.replace(/[^0-9]/g, ""))} placeholder="Account number" placeholderTextColor={theme.muted} keyboardType="number-pad" onFocus={onFocus} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><Pressable disabled={busy} onPress={() => void save()} style={[styles.saveButton, styles.payoutSaveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Saving…" : "Save payout profile"}</Text></Pressable></> : null}</View>;
}

function FinanceStat({ label, value, theme, styles }: { label: string; value: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.financeStat, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeStatLabel, { color: theme.muted }]}>{label}</Text><Text style={[styles.financeStatValue, { color: theme.ink }]}>{value}</Text></View>;
}

function FinanceRow({ entry, theme, styles }: { entry: SettlementEntry; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <Pressable onPress={() => Alert.alert(`Order ${entry.orderId}`, `Gross item sales: ${usd(entry.grossCents, entry.currency)}\nUvel fees: −${usd(entry.feeCents, entry.currency)}\nRefunds: −${usd(entry.refundCents, entry.currency)}\nNet item earnings: ${usd(entry.netCents, entry.currency)}\n\nSettlement status: ${entry.status}`)} style={[styles.financeRow, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{entry.productPhoto ? <Image cachePolicy="memory-disk" source={{ uri: entry.productPhoto }} style={styles.financeImg} contentFit="cover" /> : null}<View style={{ flex: 1 }}><Text style={[styles.financeRowTitle, { color: theme.ink }]} numberOfLines={1}>{entry.productName}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>{entry.orderId} · {new Date(entry.orderDate).toLocaleDateString()} · {entry.status}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>Gross {usd(entry.grossCents, entry.currency)} · Fees {usd(entry.feeCents, entry.currency)}{entry.refundCents ? ` · Refund ${usd(entry.refundCents, entry.currency)}` : ""}</Text></View><Text style={[styles.financeRowAmount, { color: theme.ink }]}>{usd(entry.netCents, entry.currency)}</Text></Pressable>;
}

function SupportSection({ brand, cases, manager, theme, styles, viewerName }: { brand: Brand; cases: SupportCase[]; manager: boolean; theme: HQTheme; styles: ReturnType<typeof make>; viewerName: string }) {
  const [filter, setFilter] = useState<"all" | "attention" | "waiting" | "resolved">("attention");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteId, setNoteId] = useState("");
  const openCases = cases.filter((item) => !["resolved", "closed"].includes(item.status));
  const urgentCases = openCases.filter((item) => item.priority === "urgent");
  const attentionCases = openCases.filter((item) => !["waiting_on_buyer"].includes(item.status) || item.priority === "urgent");
  const visible = (filter === "all" ? cases : filter === "attention" ? attentionCases : filter === "waiting" ? cases.filter((item) => item.status === "waiting_on_buyer") : cases.filter((item) => ["resolved", "closed"].includes(item.status)))
    .slice()
    .sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent") || Number(b.status === "escalated") - Number(a.status === "escalated") || b.lastAt - a.lastAt);
  const agents = brand.members.filter((member) => ["owner", "admin", "support"].includes(member.role));

  async function saveNote(item: SupportCase) {
    if (!manager || busyId === item.id) return;
    setBusyId(item.id);
    try {
      await addSupportInternalNote(item.id, notes[item.id] || "", viewerName);
      setNotes((current) => ({ ...current, [item.id]: "" }));
      setNoteId("");
    } catch (error) {
      Alert.alert("Team note", error instanceof Error ? error.message : "Could not save this note.");
    } finally {
      setBusyId("");
    }
  }

  function chooseAssignee(item: SupportCase) {
    Alert.alert("Assign support case", "Choose a support teammate.", [...agents.map((agent) => ({ text: agent.name, onPress: () => void changeCase(item, { assigneeUid: agent.uid, assigneeName: agent.name }) })), { text: "Unassign", onPress: () => void changeCase(item, { assigneeUid: "", assigneeName: "" }) }, { text: "Cancel", style: "cancel" as const }]);
  }

  function openActions(item: SupportCase) {
    if (!manager) return;
    Alert.alert("Case actions", undefined, [
      { text: item.assigneeName ? `Assigned to ${item.assigneeName}` : "Assign to teammate", onPress: () => chooseAssignee(item) },
      { text: item.priority === "urgent" ? "Mark normal" : "Mark urgent", onPress: () => void changeCase(item, { priority: item.priority === "urgent" ? "normal" : "urgent" }) },
      { text: item.status === "escalated" ? "De-escalate" : "Escalate", onPress: () => void changeCase(item, { status: item.status === "escalated" ? "in_progress" : "escalated" }) },
      { text: noteId === item.id ? "Close team note" : "Add team note", onPress: () => setNoteId(noteId === item.id ? "" : item.id) },
      { text: ["resolved", "closed"].includes(item.status) ? "Reopen case" : "Resolve case", onPress: () => void changeCase(item, { status: ["resolved", "closed"].includes(item.status) ? "open" : "resolved" }) },
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  async function changeCase(item: SupportCase, patch: Partial<Pick<SupportCase, "status" | "priority" | "assigneeUid" | "assigneeName">>) {
    if (!manager || busyId === item.id) return;
    setBusyId(item.id);
    try {
      await updateSupportCase(item.id, patch);
    } catch (error) {
      Alert.alert("Support update", error instanceof Error ? error.message : "Could not update this support case.");
    } finally {
      setBusyId("");
    }
  }

  function openConversation(item: SupportCase) {
    router.push({ pathname: "/ask/[id]", params: { id: item.pieceId, threadId: item.threadId, orderId: item.orderId, supportCaseId: item.id } });
  }

  const emptyText = cases.length ? filter === "attention" ? "Nothing needs attention right now." : filter === "waiting" ? "No cases are waiting on a buyer." : filter === "resolved" ? "No resolved cases yet." : "No cases to show." : "Buyer questions connected to orders will appear here.";
  return (
    <View>
      <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Support</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Help buyers with order problems, one conversation at a time.</Text></View></View>
      <View style={styles.supportSummary}><Text style={[styles.supportSummaryText, { color: theme.ink }]}>{openCases.length} open {openCases.length === 1 ? "case" : "cases"} · {urgentCases.length} urgent</Text><Text style={[styles.supportSummaryHint, { color: theme.muted }]}>Linked to an order and buyer</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>{([["attention", "Needs attention"], ["all", "All cases"], ["waiting", "Waiting"], ["resolved", "Resolved"]] as const).map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.orderFilter, { borderColor: filter === id ? theme.accent : theme.lineColor, backgroundColor: filter === id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}</ScrollView>
      {visible.length ? visible.map((item) => <View key={item.id} style={[styles.supportCard, { backgroundColor: theme.card, borderColor: item.priority === "urgent" || item.status === "escalated" ? theme.accent : theme.lineColor }]}>
        <View style={styles.supportHead}>{item.productPhoto ? <Image cachePolicy="memory-disk" source={{ uri: item.productPhoto }} style={styles.supportImg} contentFit="cover" /> : <View style={[styles.supportImg, { backgroundColor: theme.bg }]} />}<View style={{ flex: 1 }}><Text style={[styles.supportSubject, { color: theme.ink }]} numberOfLines={2}>{item.subject}</Text><Text style={[styles.supportMeta, { color: theme.muted }]}>{item.buyerName} · Order {item.orderId}</Text><Text style={[styles.supportProduct, { color: theme.ink }]} numberOfLines={1}>{item.productName}</Text></View>{manager ? <Pressable onPress={() => openActions(item)} hitSlop={10} style={styles.supportMore}><Text style={[styles.supportMoreText, { color: theme.ink }]}>⋯</Text></Pressable> : null}</View>
        <View style={styles.supportStatusRow}><Text style={[styles.supportStatus, { color: theme.ink, borderColor: theme.lineColor }]}>{item.status.replaceAll("_", " ")}</Text>{item.priority !== "normal" ? <Text style={[styles.supportStatus, { color: item.priority === "urgent" ? theme.accent : theme.muted, borderColor: item.priority === "urgent" ? theme.accent : theme.lineColor }]}>{item.priority}</Text> : null}{item.assigneeName ? <Text style={[styles.supportAssigned, { color: theme.muted }]}>Assigned to {item.assigneeName}</Text> : null}</View>
        <Pressable onPress={() => openConversation(item)} style={[styles.supportOpenButton, { backgroundColor: theme.accent }]}><Text style={[styles.supportOpenButtonText, { color: theme.accentInk }]}>Open conversation</Text></Pressable>
        {noteId === item.id && manager ? <View style={styles.supportNoteWrap}><TextInput value={notes[item.id] ?? ""} onChangeText={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} placeholder="Team note — hidden from the buyer" placeholderTextColor={theme.muted} style={[styles.supportNote, { color: theme.ink, borderColor: theme.lineColor }]} multiline /><Pressable disabled={busyId === item.id} onPress={() => void saveNote(item)} style={[styles.noteButton, { borderColor: theme.lineColor, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Save team note</Text></Pressable></View> : null}
      </View>) : <View style={[styles.supportEmpty, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.supportEmptyTitle, { color: theme.ink }]}>{cases.length ? "You’re all caught up" : "No support cases yet"}</Text><Text style={[styles.supportEmptyText, { color: theme.muted }]}>{emptyText}</Text></View>}
    </View>
  );
}

function AuditSection({ events, viewer, theme, styles, onSection }: { events: AuditEvent[]; viewer: boolean; theme: HQTheme; styles: ReturnType<typeof make>; onSection: (section: Section) => void }) {
  const [filter, setFilter] = useState<"all" | "product" | "order" | "support" | "team">("all");
  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Activity</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Brand activity is limited to approved Brand HQ roles.</Text></View>;
  const options = [["all", "All"], ["product", "Products"], ["order", "Orders"], ["support", "Support"], ["team", "Team"]] as const;
  const filtered = events.filter((event) => filter === "all" || filter === "support" ? filter === "all" || event.entity === "resolution" : event.entity === filter).slice(0, 100);
  const grouped: Array<{ label: string; events: AuditEvent[] }> = [];
  filtered.forEach((event) => {
    const date = new Date(event.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const label = date.toDateString() === today.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
    const bucket = grouped.find((item) => item.label === label);
    if (bucket) bucket.events.push(event); else grouped.push({ label, events: [event] });
  });
  function openEvent(event: AuditEvent) {
    if (event.entity === "product") router.push({ pathname: "/closet/[id]", params: { id: event.entityId } });
    else if (event.entity === "resolution") onSection("support");
    else if (event.entity === "team") onSection("team");
    else if (event.entity === "order") onSection("orders");
  }
  function categoryLabel(event: AuditEvent) { return event.entity === "product" ? "Product" : event.entity === "resolution" ? "Support" : event.entity === "team" ? "Team" : event.entity === "order" ? "Order" : "Brand"; }
  function actionText(event: AuditEvent) { const summary = event.summary.replace(/[.]$/, ""); if (event.entity === "product" && event.action === "product_published") return `${event.actorName} published ${event.entityName}`; if (event.entity === "product" && event.action === "product_archived") return `${event.actorName} archived ${event.entityName}`; if (event.entity === "product" && event.action === "product_drafted") return `${event.actorName} moved ${event.entityName} to drafts`; if (event.entity === "team" && event.action === "team_role_updated") return summary; return `${event.actorName}: ${summary}`; }
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Activity</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>A simple history of important changes made by you and your team.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.auditFilters}>{options.map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.orderFilter, { borderColor: filter === id ? theme.accent : theme.lineColor, backgroundColor: filter === id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}</ScrollView>
      {grouped.length ? grouped.map((group) => <View key={group.label}><Text style={[styles.activityDate, { color: theme.muted }]}>{group.label}</Text>{group.events.map((event) => <View key={event.id} style={[styles.activityCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={styles.activityHead}><View style={[styles.activityDot, { backgroundColor: theme.accent }]} /><View style={{ flex: 1 }}><Text style={[styles.activityTitle, { color: theme.ink }]}>{actionText(event)}</Text><Text style={[styles.activityMeta, { color: theme.muted }]}>{categoryLabel(event)} · {new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text><Text style={[styles.activityEntity, { color: theme.muted }]}>{event.entityName}</Text></View></View>{event.entity === "product" || event.entity === "resolution" || event.entity === "team" || event.entity === "order" ? <Pressable onPress={() => openEvent(event)} style={styles.activityLink}><Text style={[styles.activityLinkText, { color: theme.accent }]}>{event.entity === "product" ? "View product" : event.entity === "resolution" ? "View support" : event.entity === "team" ? "View team" : "View orders"} ›</Text></Pressable> : null}</View>)}</View>) : <View style={[styles.activityEmpty, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.activityEmptyTitle, { color: theme.ink }]}>Nothing here yet</Text><Text style={[styles.activityEmptyText, { color: theme.muted }]}>Important changes made by you or your team will appear here.</Text></View>}
    </View>
  );
}

function SettingsSection({ brand, uid, theme, styles, onSection }: { brand: Brand; uid: string; theme: HQTheme; styles: ReturnType<typeof make>; onSection: (section: Section) => void }) {
  const market = getMarket(brand.country);
  const owner = brand.ownerId === uid;
  const profileReady = Boolean(brand.logoUri && ((brand.tagline || "").trim() || (brand.story || "").trim()));
  const socialCount = [brand.website, brand.instagram, brand.whatsapp].filter((value) => Boolean(value?.trim())).length;
  const reviewLabel = brandCheck(brand) === "lime" ? "Green check" : brandCheck(brand) === "blue" ? "Blue check" : brandApproved(brand) ? "Approved on Uvel" : brand.reviewStatus === "human_review" ? "Human review needed" : brand.reviewStatus === "needs_information" ? "Information needed" : "Not reviewed yet";
  const trademarkLabel = brand.trademarkStatus === "registered" ? "Registered" : brand.trademarkStatus === "submitted" ? "Under review" : brand.trademarkStatus === "filed" ? "Filed" : brand.trademarkStatus === "filing" || brand.trademarkStatus === "in_progress" ? "In progress" : brand.trademarkStatus === "needs_information" ? "Needs information" : "Not started";
  const payoutLabel = brand.payoutStatus === "enabled" ? "Ready for payouts" : brand.payoutStatus === "pending" ? "Under review" : brand.payoutStatus === "needs_attention" ? "Needs attention" : "Not set up";
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Settings</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>Manage your brand information, workspace preferences, and access.</Text>
      <View style={[styles.settingsProfile, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={[styles.settingsLogo, { backgroundColor: theme.bg }]}>{brand.logoUri ? <Image cachePolicy="memory-disk" source={{ uri: brand.logoUri }} style={styles.settingsLogoImage} contentFit="cover" /> : <Text style={[styles.settingsLogoText, { color: theme.muted }]}>{brand.name.slice(0, 1).toUpperCase()}</Text>}</View><View style={{ flex: 1 }}><Text style={[styles.settingsProfileName, { color: theme.ink }]}>{brand.name}</Text><Text style={[styles.settingsProfileHandle, { color: theme.muted }]}>@{brand.handle || "brand"}</Text><Text style={[styles.settingsProfileStatus, { color: profileReady ? theme.accent : theme.muted }]}>{profileReady ? "Public profile ready" : "Public profile needs finishing"}</Text></View></View>
      <Text style={[styles.settingsHeading, { color: theme.ink }]}>Brand setup</Text>
      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><SettingsRow label="Public profile" value={profileReady ? "Ready" : "Needs finishing"} onPress={() => router.push({ pathname: "/brand/[id]", params: { id: brand.id, preview: "1" } })} theme={theme} styles={styles} /><SettingsRow label="Market" value={`${market.name} · ${market.currency}`} theme={theme} styles={styles} /><SettingsRow label="Buyer messages" value={`${brand.inquiryMemberIds?.length || 0} recipient${brand.inquiryMemberIds?.length === 1 ? "" : "s"}`} onPress={() => onSection("inbox")} theme={theme} styles={styles} /><SettingsRow label="Social links" value={socialCount ? `${socialCount} connected` : "Not added"} onPress={() => router.push({ pathname: "/brand/studio", params: { id: brand.id } })} theme={theme} styles={styles} /></View>

      <Text style={[styles.settingsHeading, { color: theme.ink }]}>Business registration</Text>
      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><SettingsRow label="Registration status" value={brand.businessRegistrationStatus === "verified" ? "Verified" : brand.businessRegistrationStatus === "submitted" ? "Under review" : "Not submitted"} onPress={() => onSection("businessRegistration")} theme={theme} styles={styles} /><SettingsRow label="Uvel review" value={reviewLabel} theme={theme} styles={styles} /></View>

      <View style={[styles.settingsOptional, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.settingsOptionalLabel, { color: theme.accent }]}>OPTIONAL</Text><Text style={[styles.settingsOptionalTitle, { color: theme.ink }]}>Trademark protection</Text><Text style={[styles.settingsOptionalCopy, { color: theme.muted }]}>File through the official office when you are ready.</Text><SettingsRow label="Status" value={owner ? trademarkLabel : `${trademarkLabel} · Owner only`} onPress={owner ? () => router.push({ pathname: "/brand/trademark", params: { id: brand.id } }) : undefined} theme={theme} styles={styles} /></View>

      <Text style={[styles.settingsHeading, { color: theme.ink }]}>Payments</Text>
      <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><SettingsRow label="Payout setup" value={payoutLabel} onPress={() => onSection("finance")} theme={theme} styles={styles} /></View>

      <View style={[styles.settingsTeam, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.settingsTeamTitle, { color: theme.ink }]}>Team and permissions</Text><Text style={[styles.settingsTeamCopy, { color: theme.muted }]}>{brand.members.length} team member{brand.members.length === 1 ? "" : "s"}. Manage who can edit products, answer buyers, view analytics, and manage money.</Text></View><Pressable onPress={() => onSection("team")} style={[styles.settingsTeamButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Manage team</Text></Pressable></View>
    </View>
  );
}

function BusinessRegistrationSection({ brand, uid, theme, styles }: { brand: Brand; uid: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const owner = brand.ownerId === uid;
  const [provider, setProvider] = useState(brand.businessRegistrationProvider || "");
  const [legalName, setLegalName] = useState(brand.legalName || "");
  const [registrationId, setRegistrationId] = useState(brand.registrationId || "");
  const [proofUri, setProofUri] = useState(brand.businessRegistrationProofUri || "");
  const [proofName, setProofName] = useState(brand.businessRegistrationProofName || "");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = brand.businessRegistrationStatus || "not_started";
  const statusCopy: Record<string, string> = { not_started: "Not submitted", in_progress: "In progress", submitted: "Under review", verified: "Verified", needs_information: "More information needed", rejected: "Needs a new submission" };
  const providers = [
    { id: "Stripe Atlas", title: "Stripe Atlas", logo: require("../../assets/providers/stripe-atlas.png"), url: "https://stripe.com/atlas" },
    { id: "doola", title: "doola", logo: require("../../assets/providers/doola.jpg"), url: "https://www.doola.com/formation/" },
    { id: "Firstbase", title: "Firstbase", logo: require("../../assets/providers/firstbase.png"), url: "https://www.firstbase.io/start-with-firstbase" },
  ];
  async function chooseFile() {
    try {
      const picked = await importFounderWork();
      if (!picked) return;
      setProofUri(picked.uri);
      setProofName(picked.name);
    } catch (error) {
      Alert.alert("Could not attach file", error instanceof Error ? error.message : "Choose a PDF, image, or screenshot.");
    }
  }
  async function choosePhoto() {
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      setProofUri(uri);
      setProofName("Photo from camera roll");
    } catch (error) {
      Alert.alert("Could not choose photo", error instanceof Error ? error.message : "Allow Uvel to access your photos.");
    }
  }
  async function submit() {
    if (!owner || busy) return;
    if (!legalName.trim() || !registrationId.trim() || !proofUri) {
      Alert.alert("Add your registration details", "Add your legal business name, registration number, and a document or screenshot before submitting.");
      return;
    }
    setBusy(true);
    updateBrand(brand.id, { legalName: legalName.trim(), registrationId: registrationId.trim(), businessRegistrationProvider: provider.trim() || "Other", businessRegistrationProofUri: proofUri, businessRegistrationProofName: proofName, businessRegistrationStatus: "submitted", businessRegistrationSubmittedAt: Date.now() });
    void recordAuditEvent({ brandId: brand.id, action: "business_registration_submitted", entity: "brand", entityId: brand.id, entityName: brand.name, summary: "Business registration submitted for Uvel review.", metadata: { provider: provider.trim() || "Other" } });
    setBusy(false);
    setShowReviewForm(false);
    Alert.alert("Submitted", "Your proof is under review.");
  }
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Business registration</Text>
      <View style={[styles.registrationOptional, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.registrationOptionalLabel, { color: theme.accent }]}>OPTIONAL</Text><Text style={[styles.registrationOptionalTitle, { color: theme.ink }]}>Business registration is optional.</Text><Text style={[styles.registrationOptionalCopy, { color: theme.muted }]}>Register only if needed.</Text></View>
      <Text style={[styles.settingsHeading, { color: theme.ink }]}>Registration options</Text>
      <View style={[styles.registrationProviderList, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{providers.map((item) => <Pressable key={item.id} onPress={() => { void Linking.openURL(item.url); }} style={[styles.registrationProviderRow, { borderBottomColor: theme.lineColor }]}><Image source={item.logo} style={styles.providerLogo} contentFit="contain" /><Text style={[styles.providerAction, { color: theme.accent }]}>Open ›</Text></Pressable>)}<Text style={[styles.registrationOther, { color: theme.muted }]}>Other registration sources are fine.</Text></View>
      <Pressable disabled={!owner} onPress={() => setShowReviewForm((value) => !value)} style={[styles.reviewRow, { backgroundColor: theme.card, borderColor: showReviewForm ? theme.accent : theme.lineColor }, !owner && { opacity: 0.55 }]}><View style={{ flex: 1 }}><Text style={[styles.reviewRowTitle, { color: theme.ink }]}>Submit for review</Text><Text style={[styles.reviewRowCopy, { color: theme.muted }]}>{statusCopy[status]}{proofName ? ` · ${proofName}` : ""}</Text></View><Text style={[styles.providerAction, { color: theme.accent }]}>{showReviewForm ? "Close" : "Open"}</Text></Pressable>
      {showReviewForm ? <View style={[styles.registrationForm, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><TextInput editable={owner} value={provider} onChangeText={setProvider} placeholder="Registration source (optional)" placeholderTextColor={theme.muted} style={[styles.registrationInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput editable={owner} value={legalName} onChangeText={setLegalName} placeholder="Legal/business name" placeholderTextColor={theme.muted} style={[styles.registrationInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput editable={owner} value={registrationId} onChangeText={setRegistrationId} placeholder="Registration number" placeholderTextColor={theme.muted} style={[styles.registrationInput, { color: theme.ink, borderColor: theme.lineColor }]} /><View style={styles.attachmentActions}><Pressable onPress={() => void chooseFile()} style={[styles.attachmentButton, { borderColor: theme.lineColor }]}><Text style={[styles.proofButtonText, { color: theme.ink }]}>Attach PDF or file</Text></Pressable><Pressable onPress={() => void choosePhoto()} style={[styles.attachmentButton, { borderColor: theme.lineColor }]}><Text style={[styles.proofButtonText, { color: theme.ink }]}>Choose photo</Text></Pressable></View>{proofName ? <View style={styles.attachmentName}><Text style={[styles.proofButtonText, { color: theme.ink }]} numberOfLines={1}>{proofName}</Text><Pressable onPress={() => { setProofUri(""); setProofName(""); }}><Text style={[styles.removeProof, { color: theme.muted }]}>Remove</Text></Pressable></View> : null}<Text style={[styles.registrationHelp, { color: theme.muted }]}>Uvel will review the document before showing Verified.</Text><Pressable disabled={busy} onPress={() => void submit()} style={[styles.registrationSubmit, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.registrationSubmitText, { color: theme.accentInk }]}>{busy ? "Submitting…" : "Submit for review"}</Text></Pressable></View> : null}
    </View>
  );
}

function SettingsRow({ label, value, onPress, theme, styles }: { label: string; value: string; onPress?: () => void; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const content = <><Text style={[styles.settingsRowLabel, { color: theme.muted }]}>{label}</Text><View style={styles.settingsRowValueWrap}><Text style={[styles.settingsRowValue, { color: theme.ink }]} numberOfLines={1}>{value}</Text>{onPress ? <Text style={[styles.settingsRowArrow, { color: theme.muted }]}>›</Text> : null}</View></>;
  return onPress ? <Pressable onPress={onPress} style={[styles.settingsRow, { borderBottomColor: theme.lineColor }]}>{content}</Pressable> : <View style={[styles.settingsRow, { borderBottomColor: theme.lineColor }]}>{content}</View>;
}

function Stat({ label, value, theme, styles }: { label: string; value: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.stat, { backgroundColor: theme.card }]}><Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text></View>;
}

function ActionCard({ title, copy, button, onPress, theme, styles }: { title: string; copy: string; button: string; onPress: () => void; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.actionCard, { backgroundColor: theme.card }]}><Text style={[styles.actionTitle, { color: theme.ink }]}>{title}</Text><Text style={[styles.actionCopy, { color: theme.muted }]}>{copy}</Text><Pressable onPress={onPress} style={[styles.actionButton, { borderColor: theme.lineColor }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>{button} →</Text></Pressable></View>;
}

function Empty({ text, theme, styles }: { text: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.empty, { borderColor: theme.lineColor }]}><Text style={[styles.emptyTxt, { color: theme.muted }]}>{text}</Text></View>;
}

function Detail({ label, value, theme, styles }: { label: string; value: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.detailRow, { borderBottomColor: theme.lineColor }]}><Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text><Text style={[styles.detailValue, { color: theme.ink }]} numberOfLines={2}>{value}</Text></View>;
}

function make(theme: HQTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.bg },
    content: { paddingHorizontal: 20 },
    entryBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: 12 },
    entryWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingBottom: 80 },
    entryIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 22, overflow: "hidden" },
    entryIconImage: { width: 64, height: 64 },
    entryTitle: { fontSize: 26, lineHeight: 32, fontWeight: "800", textAlign: "center" },
    entryCopy: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 310 },
    entryButton: { minHeight: 50, paddingHorizontal: 24, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 24 },
    entryButtonText: { fontSize: 15, fontWeight: "800" },
    top: { flexDirection: "row", alignItems: "center", minHeight: 48 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    backTxt: { fontSize: 34, lineHeight: 36, marginTop: -4 },
    title: { color: theme.ink, fontSize: 24, fontWeight: "700", marginTop: 20 },
    topBrand: { flex: 1, alignItems: "center" },
    topSpacer: { width: 32 },
    topKicker: { fontSize: 9, letterSpacing: 1.6, fontWeight: "700" },
    topNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    topTitle: { fontSize: 20, fontWeight: "700" },
    hero: { borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", marginTop: 12 },
    logo: { width: 58, height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    logoTxt: { fontSize: 24, fontWeight: "800" },
    heroCopy: { flex: 1, paddingLeft: 14 },
    heroTitle: { fontSize: 25, fontWeight: "800" },
    heroP: { fontSize: 13, lineHeight: 18, marginTop: 5 },
    nav: { gap: 8, paddingVertical: 18 },
    navChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: theme.lineColor, justifyContent: "center" },
    navTxt: { fontSize: 12, fontWeight: "700" },
    sectionKicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: "700", marginTop: 4, marginBottom: 10 },
    sectionTitle: { fontSize: 27, fontWeight: "800", marginTop: 10 },
    sectionP: { fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 14 },
    stats: { flexDirection: "row", gap: 10 },
    stat: { flex: 1, borderRadius: 16, padding: 14 },
    statValue: { fontSize: 24, fontWeight: "800" },
    statLabel: { fontSize: 12, marginTop: 5 },
    sectionHead: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    smallCta: { height: 38, paddingHorizontal: 14, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    smallCtaTxt: { fontSize: 12, fontWeight: "800" },
    actionCard: { borderRadius: 18, padding: 16, marginTop: 10 },
    actionTitle: { fontSize: 16, fontWeight: "800" },
    actionCopy: { fontSize: 13, lineHeight: 19, marginTop: 5 },
    actionButton: { alignSelf: "flex-start", height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, justifyContent: "center", marginTop: 12 },
    actionButtonTxt: { fontSize: 12, fontWeight: "800" },
    note: { fontSize: 12, lineHeight: 18, marginTop: 18 },
    makeCard: { borderRadius: 18, padding: 16, marginTop: 12 },
    makeKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
    makeTitle: { fontSize: 18, fontWeight: "800", marginTop: 6 },
    makeCopy: { fontSize: 14, lineHeight: 20, marginTop: 6 },
    makeStatus: { fontSize: 13, fontWeight: "700", marginTop: 14 },
    makeBtn: { alignSelf: "flex-start", height: 38, paddingHorizontal: 14, borderRadius: 19, alignItems: "center", justifyContent: "center", marginTop: 14 },
    makeBtnTxt: { fontSize: 13, fontWeight: "800" },
    moreRow: { marginTop: 10, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    moreTitle: { fontSize: 16, fontWeight: "700" },
    moreCopy: { fontSize: 13, marginTop: 4 },
    moreGo: { fontSize: 22, marginTop: -4 },
    marketKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "800", marginTop: 2 },
    marketSummary: { fontSize: 17, fontWeight: "800", marginTop: 5 },
    marketPicker: { gap: 8, paddingVertical: 10 },
    marketChip: { minWidth: 72, height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, justifyContent: "center" },
    marketChipCode: { fontSize: 12, fontWeight: "900" },
    marketChipName: { fontSize: 9, marginTop: 2 },
    marketHint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
    bulkCard: { borderRadius: 18, padding: 14, marginTop: 14 },
    bulkHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    catalogAlertOptions: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 10 },
    bulkTitle: { fontSize: 14, fontWeight: "800" },
    bulkP: { fontSize: 12, lineHeight: 17, marginTop: 4 },
    bulkCurrency: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    bulkFields: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    bulkInput: { flex: 1, height: 38, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, fontSize: 13 },
    bulkButton: { height: 38, paddingHorizontal: 13, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    bulkButtonTxt: { fontSize: 12, fontWeight: "800" },
    catalogWrap: { borderRadius: 18, overflow: "hidden", marginTop: 10 },
    catalogRow: { padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 0 },
    catalogImg: { width: 68, height: 86, borderRadius: 12 },
    catalogCopy: { flex: 1, minWidth: 0 },
    catalogName: { fontSize: 15, fontWeight: "800" },
    catalogMeta: { fontSize: 12, marginTop: 5 },
    catalogPrice: { fontSize: 12, fontWeight: "700", marginTop: 6 },
    stockPill: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: "center" },
    stockTxt: { fontSize: 10, fontWeight: "800" },
    rowArrow: { fontSize: 26, marginRight: 2 },
    editor: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
    editorTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editorKicker: { fontSize: 10, letterSpacing: 1.1, fontWeight: "800" },
    editorLabel: { fontSize: 12, marginTop: 10 },
    shippingContext: { fontSize: 11, lineHeight: 16, marginTop: 4 },
    editorInput: { height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontSize: 14, marginTop: 7 },
    variantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7 },
    variantName: { fontSize: 13, fontWeight: "700" },
    variantInput: { width: 88, height: 36, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, textAlign: "right", fontSize: 13 },
    editorActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
    saveButton: { height: 34, paddingHorizontal: 13, borderRadius: 17, justifyContent: "center" },
    saveButtonTxt: { fontSize: 12, fontWeight: "800" },
    readOnly: { fontSize: 12, padding: 14, paddingTop: 0 },
    orderStats: { flexDirection: "row", gap: 10, marginTop: 4 },
    catalogFilters: { gap: 8, paddingVertical: 12 },
    auditFilters: { gap: 8, paddingVertical: 12 },
    auditCard: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 9 },
    auditHead: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    auditAction: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
    auditMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
    auditEntity: { fontSize: 11, lineHeight: 16, marginTop: 9, textTransform: "capitalize" },
    activityDate: { fontSize: 12, fontWeight: "900", marginTop: 18, marginBottom: 5 },
    activityCard: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 8 },
    activityHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    activityTitle: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
    activityMeta: { fontSize: 11, marginTop: 5 },
    activityEntity: { fontSize: 12, fontWeight: "700", marginTop: 5 },
    activityLink: { alignSelf: "flex-start", marginTop: 11 },
    activityLinkText: { fontSize: 12, fontWeight: "900" },
    activityEmpty: { borderWidth: 1, borderRadius: 18, padding: 22, marginTop: 16, alignItems: "center" },
    activityEmptyTitle: { fontSize: 16, fontWeight: "900" },
    activityEmptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 5 },
    orderFilters: { gap: 8, paddingVertical: 12 },
    orderFilter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
    orderFilterTxt: { fontSize: 11, fontWeight: "800" },
    orderCard: { borderRadius: 18, marginTop: 10, overflow: "hidden" },
    orderHead: { padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
    orderImg: { width: 64, height: 78, borderRadius: 11 },
    orderCopy: { flex: 1, minWidth: 0 },
    orderName: { fontSize: 14, fontWeight: "800" },
    orderMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
    orderTotal: { fontSize: 12, fontWeight: "800", marginTop: 5 },
    orderDetail: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
    shipmentBox: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 10 },
    trackingLink: { fontSize: 12, fontWeight: "800", marginTop: 7 },
    exceptionText: { fontSize: 12, lineHeight: 17, marginTop: 7, fontWeight: "700" },
    resolutionBox: { marginTop: 12, padding: 11, borderWidth: 1, borderRadius: 12 },
    orderKicker: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
    orderInput: { height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, fontSize: 13, marginTop: 9 },
    orderActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
    financeStats: { flexDirection: "row", gap: 8, marginTop: 10 },
    financeStat: { flex: 1, minHeight: 78, borderWidth: 1, borderRadius: 16, padding: 11, justifyContent: "space-between" },
    financeStatLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
    financeStatValue: { fontSize: 16, fontWeight: "900", marginTop: 9 },
    financeBreakdown: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    financeBreakdownTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
    financeLine: { fontSize: 12, lineHeight: 21 },
    payoutCard: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    marketingStats: { flexDirection: "row", gap: 8, marginTop: 10 },
    marketingComposer: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    marketingInput: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontSize: 13, marginTop: 10 },
    marketingBody: { minHeight: 84, textAlignVertical: "top", paddingTop: 10 },
    marketingLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 13, marginBottom: 5 },
    marketingChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    marketingChoice: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 36, justifyContent: "center" },
    marketingChoiceTxt: { fontSize: 11, fontWeight: "800" },
    campaignFocus: { marginTop: 12, padding: 11, borderWidth: 1, borderRadius: 11, gap: 4 },
    campaignFocusLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
    campaignFocusText: { fontSize: 11, lineHeight: 17, fontWeight: "700", textTransform: "capitalize" },
    marketingProducts: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    marketingProduct: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 36, justifyContent: "center", maxWidth: "100%" },
    marketingProductTxt: { fontSize: 11, fontWeight: "700" },
    marketingCard: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 10 },
    marketingActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, maxWidth: 190 },
    marketingCardTitle: { fontSize: 14, fontWeight: "900" },
    analyticsSource: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    analyticsDot: { width: 7, height: 7, borderRadius: 4 },
    analyticsSourceText: { flex: 1, fontSize: 11, lineHeight: 16 },
    analyticsTabs: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 2 },
    analyticsTab: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    analyticsTabText: { fontSize: 12, fontWeight: "900" },
    analyticsSubheading: { fontSize: 17, fontWeight: "900", marginTop: 20, marginBottom: 2 },
    analyticsSecondary: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 11, marginTop: 12 },
    analyticsSecondaryText: { fontSize: 11 },
    analyticsInsight: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 14 },
    analyticsInsightLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    analyticsInsightTitle: { fontSize: 15, fontWeight: "900", marginTop: 6, marginBottom: 3 },
    analyticsPanel: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    analyticsRecommendation: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    analyticsRecommendationTitle: { fontSize: 13, fontWeight: "900", marginBottom: 2 },
    analyticsTone: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    analyticsProduct: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    analyticsProductImg: { width: 48, height: 60, borderRadius: 8 },
    analyticsMarket: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    analyticsCampaign: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    growthTool: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    growthHero: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 10 },
    growthEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    growthHeroTitle: { fontSize: 21, fontWeight: "900", marginTop: 7 },
    growthHeroCopy: { fontSize: 13, lineHeight: 19, marginTop: 6 },
    growthProgressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginTop: 15 },
    growthProgressFill: { height: "100%", borderRadius: 4 },
    growthPrimary: { borderRadius: 18, padding: 16, marginTop: 10 },
    growthPrimaryLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    growthPrimaryTitle: { fontSize: 20, fontWeight: "900", marginTop: 7 },
    growthPrimaryCopy: { fontSize: 13, lineHeight: 19, marginTop: 5 },
    growthPrimaryButton: { minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 14, alignSelf: "flex-start" },
    growthPrimaryButtonText: { fontSize: 13, fontWeight: "900" },
    growthChecklist: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, marginTop: 8 },
    growthStep: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
    growthStepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    growthStepIconText: { fontSize: 13, fontWeight: "900" },
    growthStepTitle: { fontSize: 13, fontWeight: "900" },
    growthStepCopy: { fontSize: 11, lineHeight: 16, marginTop: 3 },
    growthStepAction: { minHeight: 34, borderWidth: 1, borderRadius: 17, justifyContent: "center", paddingHorizontal: 12 },
    growthStepActionText: { fontSize: 11, fontWeight: "900" },
    growthNotice: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 12 },
    growthNoticeTitle: { fontSize: 13, fontWeight: "900" },
    growthNoticeCopy: { fontSize: 12, lineHeight: 17, marginTop: 4 },
    growthNoticeAction: { fontSize: 12, fontWeight: "900", marginTop: 8 },
    growthAnalyticsLink: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    growthNote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
    channelReportRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
    channelReportName: { fontSize: 13, fontWeight: "900" },
    earningsHero: { borderWidth: 1, borderRadius: 20, padding: 17, marginTop: 10 },
    earningsEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    earningsHeroValue: { fontSize: 34, fontWeight: "900", marginTop: 7 },
    earningsHeroCopy: { fontSize: 12, lineHeight: 17, marginTop: 5 },
    earningsPayout: { marginTop: 13, gap: 8 },
    earningsToggle: { minHeight: 46, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    earningsToggleText: { fontSize: 12, fontWeight: "900" },
    earningsToggleArrow: { fontSize: 18, fontWeight: "900" },
    payoutSetup: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    payoutSetupHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 9 },
    payoutManageButton: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    payoutManageText: { fontSize: 12, fontWeight: "900" },
    payoutManageArrow: { fontSize: 18, fontWeight: "900" },
    payoutLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 12, marginBottom: 5 },
    payoutTypeRow: { flexDirection: "row", gap: 8 },
    payoutTypeChip: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    payoutTypeText: { fontSize: 12, fontWeight: "800" },
    payoutInput: { height: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontSize: 13, marginTop: 11 },
    payoutSaveButton: { marginTop: 14 },
    financeHeading: { fontSize: 16, fontWeight: "900", marginTop: 20, marginBottom: 2 },
    financeRow: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    financeImg: { width: 42, height: 52, borderRadius: 8 },
    financeRowTitle: { fontSize: 13, fontWeight: "800" },
    financeRowMeta: { fontSize: 10, lineHeight: 15, marginTop: 3 },
    financeRowAmount: { fontSize: 12, fontWeight: "900" },
    payoutRow: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 8, flexDirection: "row", alignItems: "center" },
    payoutStatus: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    supportCard: { borderWidth: 1, borderRadius: 18, padding: 13, marginTop: 10 },
    supportHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    supportImg: { width: 48, height: 58, borderRadius: 10 },
    supportSubject: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
    supportMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
    supportPriority: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    supportProduct: { fontSize: 12, fontWeight: "700", marginTop: 10 },
    supportSummary: { marginTop: 10, paddingVertical: 3 },
    supportSummaryText: { fontSize: 14, fontWeight: "900" },
    supportSummaryHint: { fontSize: 11, marginTop: 3 },
    supportMore: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
    supportMoreText: { fontSize: 24, lineHeight: 24, fontWeight: "900" },
    supportStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 11 },
    supportStatus: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: "900", textTransform: "capitalize" },
    supportAssigned: { fontSize: 10, marginLeft: 2 },
    supportOpenButton: { minHeight: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 12 },
    supportOpenButtonText: { fontSize: 13, fontWeight: "900" },
    supportNoteWrap: { marginTop: 2 },
    supportActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, marginTop: 10, flexWrap: "wrap" },
    supportNote: { minHeight: 54, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, fontSize: 12, textAlignVertical: "top" },
    noteButton: { alignSelf: "flex-end", borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, marginTop: 7 },
    supportEmpty: { borderWidth: 1, borderRadius: 18, padding: 22, marginTop: 12, alignItems: "center" },
    supportEmptyTitle: { fontSize: 16, fontWeight: "900" },
    supportEmptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 5 },
    featureKicker: { fontSize: 10, letterSpacing: 1.3, fontWeight: "800" },
    featureTitle: { fontSize: 19, fontWeight: "800", marginTop: 8 },
    featureP: { fontSize: 13, lineHeight: 19, marginTop: 8 },
    memberCard: { borderRadius: 18, paddingHorizontal: 14, marginTop: 10 },
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, gap: 11 },
    memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
    memberAvatarTxt: { fontWeight: "800" },
    memberName: { fontSize: 14, fontWeight: "800" },
    memberMeta: { fontSize: 12, marginTop: 3 },
    manageTxt: { fontSize: 12, fontWeight: "800" },
    settingsProfile: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 },
    settingsLogo: { width: 58, height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    settingsLogoImage: { width: 58, height: 58 },
    settingsLogoText: { fontSize: 24, fontWeight: "900" },
    settingsProfileName: { fontSize: 17, fontWeight: "900" },
    settingsProfileHandle: { fontSize: 12, marginTop: 2 },
    settingsProfileStatus: { fontSize: 11, fontWeight: "800", marginTop: 6 },
    settingsHeading: { fontSize: 16, fontWeight: "900", marginTop: 22, marginBottom: 2 },
    settingsCard: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, marginTop: 8 },
    settingsRow: { minHeight: 48, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    settingsRowLabel: { fontSize: 12 },
    settingsRowValueWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
    settingsRowValue: { fontSize: 12, fontWeight: "800", textAlign: "right" },
    settingsRowArrow: { fontSize: 21, lineHeight: 21 },
    settingsOptional: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 22 },
    settingsOptionalLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    settingsOptionalTitle: { fontSize: 16, fontWeight: "900", marginTop: 6 },
    settingsOptionalCopy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
    settingsTeam: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
    settingsTeamTitle: { fontSize: 15, fontWeight: "900" },
    settingsTeamCopy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
    settingsTeamButton: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 9 },
    registrationNotice: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 10 },
    registrationNoticeTitle: { fontSize: 14, fontWeight: "900" },
    registrationNoticeCopy: { fontSize: 12, lineHeight: 18, marginTop: 5 },
    providerCard: { borderWidth: 1, borderRadius: 17, padding: 13, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    providerTitle: { fontSize: 14, fontWeight: "900" },
    providerCopy: { fontSize: 12, lineHeight: 17, marginTop: 3 },
    providerAction: { fontSize: 12, fontWeight: "900" },
    registrationForm: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 8, marginBottom: 18 },
    registrationStatus: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: 4 },
    registrationLabel: { fontSize: 12, marginTop: 12 },
    registrationInput: { borderWidth: 1, borderRadius: 13, height: 46, paddingHorizontal: 12, marginTop: 6, fontSize: 14 },
    registrationHelp: { fontSize: 12, lineHeight: 18, marginTop: 12 },
    registrationSubmit: { borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 14 },
    registrationSubmitText: { fontSize: 14, fontWeight: "900" },
    registrationOptional: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 10 },
    registrationOptionalLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    registrationOptionalTitle: { fontSize: 15, fontWeight: "900", lineHeight: 20, marginTop: 5 },
    registrationOptionalCopy: { fontSize: 12, lineHeight: 17, marginTop: 5 },
    registrationProviderList: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, marginTop: 8 },
    registrationProviderRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
    providerLogo: { width: 118, height: 30 },
    registrationOther: { fontSize: 12, lineHeight: 17, paddingVertical: 12 },
    reviewRow: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 },
    reviewRowTitle: { fontSize: 15, fontWeight: "900" },
    reviewRowCopy: { fontSize: 12, lineHeight: 17, marginTop: 4 },
    proofButton: { minHeight: 46, borderWidth: 1, borderRadius: 13, justifyContent: "center", paddingHorizontal: 12, marginTop: 10 },
    proofButtonText: { fontSize: 13, fontWeight: "800" },
    attachmentActions: { flexDirection: "row", gap: 8, marginTop: 10 },
    attachmentButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 13, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
    attachmentName: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 },
    removeProof: { fontSize: 11, textDecorationLine: "underline", marginTop: 7 },
    detailCard: { borderRadius: 18, paddingHorizontal: 16, marginTop: 12 },
    detailRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", gap: 14 },
    detailLabel: { fontSize: 12 },
    detailValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "700" },
    empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 18, padding: 28, marginTop: 12, alignItems: "center" },
    emptyTxt: { fontSize: 14, textAlign: "center" },
  });
}
