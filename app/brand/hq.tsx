import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerifiedMark } from "../../components/VerifiedMark";
import {
  canAccessHQ,
  canManageCatalog,
  canManageOrders,
  canViewAudit,
  canManageTeam,
  canViewOrders,
  canSeeAnalytics,
  getBrand,
  inquiryRecipients,
  memberRoleLabel,
  roleOn,
  themeFor,
  updateBrand,
  useBrands,
  type Brand,
  type BrandMember,
  type MemberRole,
  canManagePayouts,
  canViewFinance,
} from "../../lib/brands";
import { usd } from "../../lib/catalog";
import { financeTotals, requestBrandPayout, savePayoutProfile, settlementLedger, usePayoutProfile, usePayouts, type PayoutDestinationType, type SettlementEntry } from "../../lib/finance";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";
import { MARKETS, getMarket } from "../../lib/markets";
import { recordAuditEvent, useAudit, type AuditEvent } from "../../lib/audit";
import { createOrderShipment, reviewOrderResolution, updateOrderFulfillment, updateOrderShipment, useOrders, watchBrandOrders, type FulfillmentStatus, type Order, type ShippingExceptionCode } from "../../lib/orders";
import { addSupportInternalNote, updateSupportCase, useSupportCases, type SupportCase, type SupportStatus } from "../../lib/support";
import { archivePiece, createBrandCatalogRemote, duplicatePiece, restorePiece, updateBrandCatalogRemote, updatePiece, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { shipsToLabel } from "../../lib/ships";

type Section = "overview" | "catalog" | "orders" | "finance" | "support" | "inbox" | "analytics" | "audit" | "team" | "settings";

type CatalogAuditInput = Parameters<typeof recordAuditEvent>[0];

function syncCatalogEdit(id: string, patch: Partial<ClosetPiece>, audit?: CatalogAuditInput) {
  void updateBrandCatalogRemote(id, patch)
    .then((remote) => { if (!remote && audit) void recordAuditEvent(audit); })
    .catch(() => { if (audit) void recordAuditEvent(audit); });
}
type HQTheme = { bg: string; ink: string; muted: string; card: string; accent: string; accentInk: string; lineColor: string };

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "catalog", label: "Catalog" },
  { id: "orders", label: "Orders" },
  { id: "finance", label: "Finance" },
  { id: "support", label: "Support" },
  { id: "inbox", label: "Inbox" },
  { id: "analytics", label: "Analytics" },
  { id: "audit", label: "Audit log" },
  { id: "team", label: "Team" },
  { id: "settings", label: "Settings" },
];

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
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const orders = useOrders();
  const auditEvents = useAudit(id || "");
  const supportCases = useSupportCases(id || "");
  const brand = getBrand(id);
  const theme: HQTheme = brand ? themeFor(brand) : { bg: colors.ink, ink: colors.bone, muted: colors.muted, card: colors.surface, accent: colors.pulse, accentInk: colors.ink, lineColor: colors.subtle };
  const styles = useMemo(() => make(theme), [theme]);
  const [section, setSection] = useState<Section>("overview");

  useEffect(() => {
    if (!id) return;
    return watchBrandOrders(id);
  }, [id]);

  if (!brand || !canAccessHQ(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.backTxt}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Brand HQ is for the brand team.</Text>
      </View>
    );
  }

  const activeBrand = brand;
  const catalog = pieces.filter((piece) => piece.brandId === activeBrand.id);
  const activeCatalog = catalog.filter((piece) => piece.status === "listed");
  const lowStock = activeCatalog.filter((piece) => typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10);
  const brandOrders = orders.filter((order) => order.brandId === activeBrand.id);
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
    if (next === "analytics") {
      if (canSeeAnalytics(activeBrand, app.uid)) router.push({ pathname: "/brand/analytics", params: { id: activeBrand.id } });
      return;
    }
    setSection(next);
  }

  function changeRole(member: BrandMember) {
    if (!manager || member.role === "owner") return;
    Alert.alert(`Role for ${member.name}`, "Choose the access this person should have in Brand HQ.", [
      ...ROLE_OPTIONS.map((role) => ({ text: memberRoleLabel(role), onPress: () => { updateBrand(activeBrand.id, { members: activeBrand.members.map((m) => (m.uid === member.uid ? { ...m, role } : m)) }); void recordAuditEvent({ brandId: activeBrand.id, action: "team_role_updated", entity: "team", entityId: member.uid, entityName: member.name, summary: `${member.name} changed to ${memberRoleLabel(role)}.` }); } })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text>
          </Pressable>
          <View style={styles.topBrand}>
            <Text style={[styles.topKicker, { color: theme.muted }]}>BRAND WORKSPACE</Text>
            <View style={styles.topNameRow}>
              <Text style={[styles.topTitle, { color: theme.ink }]} numberOfLines={1}>{brand.name}</Text>
              {brand.verified ? <VerifiedMark size={16} /> : null}
            </View>
          </View>
          <View style={styles.topSpacer} />
        </View>

        <View style={[styles.hero, { backgroundColor: theme.card }]}>
          {brand.logoUri ? <Image source={{ uri: brand.logoUri }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, { backgroundColor: theme.bg }]}><Text style={[styles.logoTxt, { color: theme.ink }]}>{brand.name[0]}</Text></View>}
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.ink }]}>Brand HQ</Text>
            <Text style={[styles.heroP, { color: theme.muted }]}>Run {brand.name} with a shared team, catalog, and buyer workspace.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {SECTIONS.map((item) => {
            const active = section === item.id;
            const unavailable = (item.id === "analytics" && !canSeeAnalytics(brand, app.uid)) || (item.id === "audit" && !canViewAudit(brand, app.uid));
            return (
              <Pressable key={item.id} onPress={() => openSection(item.id)} style={[styles.navChip, active && { backgroundColor: theme.accent, borderColor: theme.accent }, unavailable && { opacity: 0.45 }]}>
                <Text style={[styles.navTxt, { color: active ? theme.accentInk : theme.ink }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {section === "overview" ? (
          <Overview brand={brand} catalogCount={activeCatalog.length} lowStockCount={lowStock.length} teamCount={brand.members.length} inquiryCount={inquiryRecipients(brand).length} theme={theme} styles={styles} onSection={openSection} />
        ) : section === "catalog" ? (
          <CatalogSection brand={brand} items={catalog} canManage={catalogManager} theme={theme} styles={styles} />
        ) : section === "orders" ? (
          <OrdersSection orders={brandOrders} viewer={orderViewer} manager={orderManager} reviewer={orderReviewer} theme={theme} styles={styles} />
        ) : section === "finance" ? (
          <FinanceSection brand={activeBrand} orders={brandOrders} viewer={canViewFinance(activeBrand, app.uid)} manager={canManagePayouts(activeBrand, app.uid)} theme={theme} styles={styles} />
        ) : section === "support" ? (
          <SupportSection brand={activeBrand} cases={supportCases} manager={orderManager} theme={theme} styles={styles} viewerName={app.displayName || "Support agent"} />
        ) : section === "audit" ? (
          <AuditSection events={auditEvents} viewer={canViewAudit(activeBrand, app.uid)} theme={theme} styles={styles} />
        ) : section === "team" ? (
          <TeamSection brand={brand} manager={manager} theme={theme} styles={styles} onRole={changeRole} />
        ) : section === "settings" ? (
          <SettingsSection brand={brand} theme={theme} styles={styles} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Overview({ brand, catalogCount, lowStockCount, teamCount, inquiryCount, theme, styles, onSection }: { brand: Brand; catalogCount: number; lowStockCount: number; teamCount: number; inquiryCount: number; theme: HQTheme; styles: ReturnType<typeof make>; onSection: (section: Section) => void }) {
  return (
    <View>
      <Text style={[styles.sectionKicker, { color: theme.muted }]}>OPERATING PICTURE</Text>
      <View style={styles.stats}>
        <Stat label="Active products" value={String(catalogCount)} theme={theme} styles={styles} />
        <Stat label="Low stock" value={String(lowStockCount)} theme={theme} styles={styles} />
        <Stat label="Team" value={String(teamCount)} theme={theme} styles={styles} />
        <Stat label="Inquiry recipients" value={String(inquiryCount)} theme={theme} styles={styles} />
      </View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Next actions</Text>
      <ActionCard title="Manage catalog" copy="Review products, stock, prices, and listing status." button="Open catalog" onPress={() => onSection("catalog")} theme={theme} styles={styles} />
      <ActionCard title="Team access" copy="Assign the right workspace role to every collaborator." button="Open team" onPress={() => onSection("team")} theme={theme} styles={styles} />
      <ActionCard title="Buyer inbox" copy="Keep brand inquiries in one shared conversation stream." button="Open inbox" onPress={() => onSection("inbox")} theme={theme} styles={styles} />
      <ActionCard title="Finance & settlements" copy="Review order-linked earnings, refunds, balances, and payout history." button="Open finance" onPress={() => onSection("finance")} theme={theme} styles={styles} />
      <ActionCard title="Support desk" copy="Work order-linked cases with assignment, escalation, and private team notes." button="Open support" onPress={() => onSection("support")} theme={theme} styles={styles} />
      {brand.verified ? <Text style={[styles.note, { color: theme.muted }]}>Verified brand workspace · {brand.country} · {brand.legalName || brand.ownerName}</Text> : null}
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
  const market = getMarket(marketCode);
  const filteredItems = items.filter((item) => filter === "all" || (filter === "active" ? item.status === "listed" : item.status === filter));
  return (
    <View>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Catalog</Text>
          <Text style={[styles.sectionP, { color: theme.muted }]}>Your product floor, stock signals, and listing status.</Text>
        </View>
        {canManage ? <Pressable onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })} style={[styles.smallCta, { backgroundColor: theme.accent }]}><Text style={[styles.smallCtaTxt, { color: theme.accentInk }]}>Add product</Text></Pressable> : null}
      </View>
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
        {item.photo ? <Image source={{ uri: item.photo }} style={styles.catalogImg} contentFit="cover" /> : <View style={[styles.catalogImg, { backgroundColor: theme.bg }]} />}
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

function OrdersSection({ orders, viewer, manager, reviewer, theme, styles }: { orders: Order[]; viewer: boolean; manager: boolean; reviewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
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
      <Text style={[styles.sectionP, { color: theme.muted }]}>Payment, fulfillment, tracking, and buyer context in one operating view.</Text>
      <View style={styles.orderStats}>
        <Stat label="All orders" value={String(orders.length)} theme={theme} styles={styles} />
        <Stat label="Needs action" value={String(needsAction.length)} theme={theme} styles={styles} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>
        {ORDER_FILTERS.map((option) => <Pressable key={option.id} onPress={() => setFilter(option.id)} style={[styles.orderFilter, { borderColor: filter === option.id ? theme.accent : theme.lineColor, backgroundColor: filter === option.id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === option.id ? theme.accentInk : theme.ink }]}>{option.label}</Text></Pressable>)}
      </ScrollView>
      {filtered.length ? filtered.map((order) => <OrderCard key={order.id} order={order} manager={manager} reviewer={reviewer} theme={theme} styles={styles} />) : <Empty text={orders.length ? "No orders match this filter." : "No brand orders yet."} theme={theme} styles={styles} />}
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

function nextFulfillment(status: FulfillmentStatus): FulfillmentStatus | null {
  if (status === "unfulfilled") return "processing";
  if (status === "processing") return "packed";
  if (status === "packed") return "shipped";
  if (status === "shipped") return "delivered";
  return null;
}

function OrderCard({ order, manager, reviewer, theme, styles }: { order: Order; manager: boolean; reviewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const fulfillment = order.fulfillmentStatus || (order.status === "paid" ? "unfulfilled" : "canceled");
  const [expanded, setExpanded] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [trackingUrl, setTrackingUrl] = useState(order.shipment?.trackingUrl || "");
  const [exceptionNote, setExceptionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const next = nextFulfillment(fulfillment);
  const shipment = order.shipment;
  const shipmentStatus = shipment?.status || (order.trackingNumber ? "in_transit" : "label_pending");
  const buyer = order.address?.name || "Buyer";
  const resolution = order.resolution;
  const resolutionLabel = resolution ? `${resolution.type === "return" ? "Return" : "Cancellation"} · ${resolution.status.replace("_", " ")}` : "";

  async function advance() {
    if (!manager || !next) return;
    if (next === "shipped" && !tracking.trim()) {
      Alert.alert("Tracking required", "Add a carrier and tracking number before marking this order shipped.");
      setExpanded(true);
      return;
    }
    setBusy(true);
    try {
      if (next === "shipped") {
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
        {order.piecePhoto ? <Image source={{ uri: order.piecePhoto }} style={styles.orderImg} contentFit="cover" /> : <View style={[styles.orderImg, { backgroundColor: theme.bg }]} />}
        <View style={styles.orderCopy}>
          <Text style={[styles.orderName, { color: theme.ink }]} numberOfLines={2}>{order.pieceName}</Text>
          <Text style={[styles.orderMeta, { color: theme.muted }]}>{buyer} · {order.country} · {order.delivery}{order.variantLabel || order.variantKey ? ` · Size ${order.variantLabel || order.variantKey}` : ""}</Text>
          <Text style={[styles.orderTotal, { color: theme.ink }]}>{usd(order.totalCents, order.currency)} · {order.status === "paid" ? FULFILLMENT_LABELS[fulfillment] : "Payment pending"}</Text>
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
          {manager && order.status === "paid" && next ? (
            <>
              <TextInput value={carrier} onChangeText={setCarrier} placeholder="Carrier" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} />
              <TextInput value={tracking} onChangeText={setTracking} placeholder="Tracking number (required before shipping)" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} autoCapitalize="characters" />
              <TextInput value={trackingUrl} onChangeText={setTrackingUrl} placeholder="Carrier tracking URL (optional)" placeholderTextColor={theme.muted} style={[styles.orderInput, { color: theme.ink, borderColor: theme.lineColor }]} autoCapitalize="none" keyboardType="url" />
              <View style={styles.orderActions}>
                <Pressable disabled={busy} onPress={() => void advance()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Saving…" : FULFILLMENT_LABELS[next]}</Text></Pressable>
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

function FinanceSection({ brand, orders, viewer, manager, theme, styles }: { brand: Brand; orders: Order[]; viewer: boolean; manager: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const payouts = usePayouts(brand.id);
  const profile = usePayoutProfile(brand.id);
  const ledger = settlementLedger(orders, brand.id);
  const currencies = Array.from(new Set(ledger.map((entry) => entry.currency)));
  const [currency, setCurrency] = useState(currencies[0] || "");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!currency && currencies[0]) setCurrency(currencies[0]);
    if (currency && !currencies.includes(currency) && currencies.length) setCurrency(currencies[0]);
  }, [currency, currencies.join(",")]);
  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Finance & settlements</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Finance data is restricted to owners, admins, and finance members.</Text></View>;
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
      <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Finance & settlements</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Order-linked earnings, refunds, available balance, and payouts.</Text></View></View>
      {currencies.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>{currencies.map((option) => <Pressable key={option} onPress={() => setCurrency(option)} style={[styles.orderFilter, { borderColor: currency === option ? theme.accent : theme.lineColor, backgroundColor: currency === option ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: currency === option ? theme.accentInk : theme.ink }]}>{option}</Text></Pressable>)}</ScrollView> : null}
      <PayoutSetup brand={brand} profile={profile} manager={manager} currency={currency || getMarket(brand.country).currency} theme={theme} styles={styles} />
      {!totals ? <Empty text="No paid brand orders yet. Settlement balances will appear after payment confirmation." theme={theme} styles={styles} /> : <>
        <View style={styles.financeStats}><FinanceStat label="Net item earnings" value={usd(totals.netCents, currency)} theme={theme} styles={styles} /><FinanceStat label="Available" value={usd(totals.availableCents, currency)} theme={theme} styles={styles} /><FinanceStat label="Pending" value={usd(totals.pendingCents, currency)} theme={theme} styles={styles} /></View>
        <View style={[styles.financeBreakdown, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>Settlement breakdown · {currency}</Text><Text style={[styles.financeLine, { color: theme.muted }]}>Gross item sales <Text style={{ color: theme.ink }}>{usd(totals.grossCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Uvel fees <Text style={{ color: theme.ink }}>−{usd(totals.feesCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Refunds <Text style={{ color: theme.ink }}>−{usd(totals.refundsCents, currency)}</Text></Text><Text style={[styles.financeLine, { color: theme.muted }]}>Payouts reserved <Text style={{ color: theme.ink }}>−{usd(totals.paidOutCents, currency)}</Text></Text></View>
        {manager ? <View style={[styles.payoutCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>Request a payout</Text><Text style={[styles.financeLine, { color: theme.muted }]}>Available to request: {usd(totals.availableCents, currency)}</Text></View><TextInput value={payoutAmount} onChangeText={(value) => setPayoutAmount(value.replace(/[^0-9.]/g, ""))} placeholder={`Amount in ${currency}`} placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><Pressable disabled={busy} onPress={() => void requestPayout()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Requesting…" : "Request payout"}</Text></Pressable></View> : null}
        <Text style={[styles.financeHeading, { color: theme.ink }]}>Transaction ledger</Text>{ledger.filter((entry) => entry.currency === currency).map((entry) => <FinanceRow key={entry.id} entry={entry} theme={theme} styles={styles} />)}
        {currencyPayouts.length ? <><Text style={[styles.financeHeading, { color: theme.ink }]}>Payout history</Text>{currencyPayouts.map((payout) => <View key={payout.id} style={[styles.payoutRow, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={{ flex: 1 }}><Text style={[styles.financeRowTitle, { color: theme.ink }]}>{usd(payout.amountCents, payout.currency)}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>{new Date(payout.requestedAt).toLocaleDateString()} · {payout.status}{payout.failureReason ? ` · ${payout.failureReason}` : ""}</Text></View><Text style={[styles.payoutStatus, { color: payout.status === "paid" ? theme.accent : theme.muted }]}>{payout.status}</Text></View>)}</> : null}
      </>}
    </View>
  );
}

function PayoutSetup({ brand, profile, manager, currency, theme, styles }: { brand: Brand; profile?: import("../../lib/finance").PayoutProfile; manager: boolean; currency: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const [destinationType, setDestinationType] = useState<PayoutDestinationType>(profile?.destinationType || "bank");
  const [legalName, setLegalName] = useState(profile?.legalName || brand.legalName || "");
  const [registrationId, setRegistrationId] = useState(profile?.registrationId || brand.registrationId || "");
  const [accountHolderName, setAccountHolderName] = useState(profile?.accountHolderName || "");
  const [institutionName, setInstitutionName] = useState(profile?.institutionName || "");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!profile) return;
    setDestinationType(profile.destinationType);
    setLegalName(profile.legalName);
    setRegistrationId(profile.registrationId);
    setAccountHolderName(profile.accountHolderName);
    setInstitutionName(profile.institutionName);
  }, [profile?.updatedAt]);

  async function save() {
    if (!manager || busy) return;
    setBusy(true);
    try {
      await savePayoutProfile({ brandId: brand.id, destinationType, country: brand.country, currency: currency || "USD", legalName, registrationId, accountHolderName, institutionName, destination });
      setDestination("");
      Alert.alert("Payout profile submitted", "Your payout destination is saved securely for review. Raw account details are not stored in the app.");
    } catch (error) {
      Alert.alert("Payout setup", error instanceof Error ? error.message : "Could not save payout setup.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = profile?.status === "verified" ? "Verified" : profile?.status === "needs_attention" ? "Needs attention" : profile?.status === "submitted" ? "Submitted for review" : "Not set up";
  return <View style={[styles.payoutSetup, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={styles.payoutSetupHead}><View style={{ flex: 1 }}><Text style={[styles.financeBreakdownTitle, { color: theme.ink }]}>Payout setup & compliance</Text><Text style={[styles.financeLine, { color: theme.muted }]}>Payouts must match the verified business filing.</Text></View><Text style={[styles.payoutStatus, { color: profile?.status === "verified" ? theme.accent : theme.muted }]}>{statusLabel}</Text></View><Text style={[styles.financeLine, { color: theme.muted }]}>Business: <Text style={{ color: theme.ink }}>{brand.legalName || brand.name}</Text> · Registration: <Text style={{ color: theme.ink }}>{brand.registrationId || "Not provided"}</Text></Text>{profile?.destinationLast4 ? <Text style={[styles.financeLine, { color: theme.muted, marginTop: 5 }]}>Saved destination: <Text style={{ color: theme.ink }}>{profile.destinationType === "bank" ? "Bank" : "Mobile money"} ending in {profile.destinationLast4}</Text></Text> : null}{manager ? <><Text style={[styles.payoutLabel, { color: theme.muted }]}>Destination type</Text><View style={styles.payoutTypeRow}><Pressable onPress={() => setDestinationType("bank")} style={[styles.payoutTypeChip, { borderColor: destinationType === "bank" ? theme.accent : theme.lineColor, backgroundColor: destinationType === "bank" ? theme.accent : theme.bg }]}><Text style={[styles.payoutTypeText, { color: destinationType === "bank" ? theme.accentInk : theme.ink }]}>Bank account</Text></Pressable><Pressable onPress={() => setDestinationType("mobile_money")} style={[styles.payoutTypeChip, { borderColor: destinationType === "mobile_money" ? theme.accent : theme.lineColor, backgroundColor: destinationType === "mobile_money" ? theme.accent : theme.bg }]}><Text style={[styles.payoutTypeText, { color: destinationType === "mobile_money" ? theme.accentInk : theme.ink }]}>Mobile money</Text></Pressable></View><TextInput value={legalName} onChangeText={setLegalName} placeholder="Verified legal business name" placeholderTextColor={theme.muted} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={registrationId} onChangeText={setRegistrationId} placeholder="Registration ID" placeholderTextColor={theme.muted} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={accountHolderName} onChangeText={setAccountHolderName} placeholder="Account holder name" placeholderTextColor={theme.muted} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={institutionName} onChangeText={setInstitutionName} placeholder={destinationType === "bank" ? "Bank name" : "Mobile-money provider"} placeholderTextColor={theme.muted} style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><TextInput value={destination} onChangeText={(value) => setDestination(value.replace(/[^0-9]/g, ""))} placeholder={destinationType === "bank" ? "Account number" : "Mobile-money number"} placeholderTextColor={theme.muted} keyboardType="number-pad" secureTextEntry style={[styles.payoutInput, { color: theme.ink, borderColor: theme.lineColor }]} /><Pressable disabled={busy} onPress={() => void save()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{busy ? "Saving…" : "Save payout profile"}</Text></Pressable></> : <Text style={[styles.financeLine, { color: theme.muted, marginTop: 9 }]}>Only owners and admins can edit payout setup. Finance members can review its status.</Text>}</View>;
}

function FinanceStat({ label, value, theme, styles }: { label: string; value: string; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <View style={[styles.financeStat, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Text style={[styles.financeStatLabel, { color: theme.muted }]}>{label}</Text><Text style={[styles.financeStatValue, { color: theme.ink }]}>{value}</Text></View>;
}

function FinanceRow({ entry, theme, styles }: { entry: SettlementEntry; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return <Pressable onPress={() => Alert.alert(`Order ${entry.orderId}`, `Gross item sales: ${usd(entry.grossCents, entry.currency)}\nUvel fees: −${usd(entry.feeCents, entry.currency)}\nRefunds: −${usd(entry.refundCents, entry.currency)}\nNet item earnings: ${usd(entry.netCents, entry.currency)}\n\nSettlement status: ${entry.status}`)} style={[styles.financeRow, { backgroundColor: theme.card, borderColor: theme.lineColor }]}>{entry.productPhoto ? <Image source={{ uri: entry.productPhoto }} style={styles.financeImg} contentFit="cover" /> : null}<View style={{ flex: 1 }}><Text style={[styles.financeRowTitle, { color: theme.ink }]} numberOfLines={1}>{entry.productName}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>{entry.orderId} · {new Date(entry.orderDate).toLocaleDateString()} · {entry.status}</Text><Text style={[styles.financeRowMeta, { color: theme.muted }]}>Gross {usd(entry.grossCents, entry.currency)} · Fees {usd(entry.feeCents, entry.currency)}{entry.refundCents ? ` · Refund ${usd(entry.refundCents, entry.currency)}` : ""}</Text></View><Text style={[styles.financeRowAmount, { color: theme.ink }]}>{usd(entry.netCents, entry.currency)}</Text></Pressable>;
}

function SupportSection({ brand, cases, manager, theme, styles, viewerName }: { brand: Brand; cases: SupportCase[]; manager: boolean; theme: HQTheme; styles: ReturnType<typeof make>; viewerName: string }) {
  const [filter, setFilter] = useState<SupportStatus | "all">("all");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const visible = filter === "all" ? cases : cases.filter((item) => item.status === filter);
  const filters: Array<[SupportStatus | "all", string]> = [["all", "All"], ["open", "Open"], ["in_progress", "In progress"], ["waiting_on_buyer", "Waiting"], ["escalated", "Escalated"], ["resolved", "Resolved"]];
  const agents = brand.members.filter((member) => ["owner", "admin", "support"].includes(member.role));

  async function saveNote(item: SupportCase) {
    if (!manager || busyId === item.id) return;
    setBusyId(item.id);
    try {
      await addSupportInternalNote(item.id, notes[item.id] || "", viewerName);
      setNotes((current) => ({ ...current, [item.id]: "" }));
    } catch (error) {
      Alert.alert("Internal note", error instanceof Error ? error.message : "Could not save this note.");
    } finally {
      setBusyId("");
    }
  }

  function chooseAssignee(item: SupportCase) {
    Alert.alert("Assign support case", "Choose a support teammate.", [...agents.map((agent) => ({ text: agent.name, onPress: () => void changeCase(item, { assigneeUid: agent.uid, assigneeName: agent.name }) })), { text: "Unassign", onPress: () => void changeCase(item, { assigneeUid: "", assigneeName: "" }) }, { text: "Cancel", style: "cancel" as const }]);
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

  return (
    <View>
      <View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Customer support</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Every case is linked to an order, product, buyer, and conversation.</Text></View></View>
      <View style={styles.orderStats}><Stat label="Open" value={String(cases.filter((item) => !["resolved", "closed"].includes(item.status)).length)} theme={theme} styles={styles} /><Stat label="Urgent" value={String(cases.filter((item) => item.priority === "urgent").length)} theme={theme} styles={styles} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilters}>{filters.map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.orderFilter, { borderColor: filter === id ? theme.accent : theme.lineColor, backgroundColor: filter === id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}</ScrollView>
      {visible.length ? visible.map((item) => <View key={item.id} style={[styles.supportCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: item.pieceId, threadId: item.threadId, orderId: item.orderId, supportCaseId: item.id } })} style={styles.supportHead}>{item.productPhoto ? <Image source={{ uri: item.productPhoto }} style={styles.supportImg} contentFit="cover" /> : <View style={[styles.supportImg, { backgroundColor: theme.bg }]} />}<View style={{ flex: 1 }}><Text style={[styles.supportSubject, { color: theme.ink }]} numberOfLines={2}>{item.subject}</Text><Text style={[styles.supportMeta, { color: theme.muted }]}>{item.buyerName} · Order {item.orderId}</Text><Text style={[styles.supportMeta, { color: theme.muted }]}>{item.category.replace("_", " ")} · {item.status.replaceAll("_", " ")}</Text></View><Text style={[styles.supportPriority, { color: item.priority === "urgent" ? theme.accent : theme.muted }]}>{item.priority}</Text></Pressable><Text style={[styles.supportProduct, { color: theme.ink }]}>{item.productName}</Text><View style={styles.supportActions}>{manager ? <><Pressable disabled={busyId === item.id} onPress={() => void changeCase(item, { status: item.status === "escalated" ? "in_progress" : "escalated" })} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>{item.status === "escalated" ? "De-escalate" : "Escalate"}</Text></Pressable><Pressable disabled={busyId === item.id} onPress={() => chooseAssignee(item)} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Assign</Text></Pressable><Pressable disabled={busyId === item.id} onPress={() => void changeCase(item, { priority: item.priority === "urgent" ? "normal" : "urgent" })} style={[styles.actionButton, { borderColor: theme.lineColor, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>{item.priority === "urgent" ? "Set normal" : "Set urgent"}</Text></Pressable><Pressable disabled={busyId === item.id} onPress={() => void changeCase(item, { status: item.status === "resolved" ? "open" : "resolved" })} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.saveButtonTxt, { color: theme.accentInk }]}>{item.status === "resolved" ? "Reopen" : "Resolve"}</Text></Pressable></> : null}</View>{manager ? <><TextInput value={notes[item.id] ?? ""} onChangeText={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} placeholder="Internal note — hidden from the buyer" placeholderTextColor={theme.muted} style={[styles.supportNote, { color: theme.ink, borderColor: theme.lineColor }]} multiline /><Pressable disabled={busyId === item.id} onPress={() => void saveNote(item)} style={[styles.noteButton, { borderColor: theme.lineColor, opacity: busyId === item.id ? 0.5 : 1 }]}><Text style={[styles.actionButtonTxt, { color: theme.ink }]}>Save internal note</Text></Pressable></> : null}</View>) : <Empty text={cases.length ? "No support cases match this filter." : "No order-linked support cases yet."} theme={theme} styles={styles} />}
    </View>
  );
}

function AuditSection({ events, viewer, theme, styles }: { events: AuditEvent[]; viewer: boolean; theme: HQTheme; styles: ReturnType<typeof make> }) {
  const [filter, setFilter] = useState("all");
  if (!viewer) return <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>Audit log</Text><Text style={[styles.sectionP, { color: theme.muted }]}>Audit history is limited to approved Brand HQ roles.</Text></View>;
  const options = [
    ["all", "All activity"],
    ["product", "Catalog"],
    ["order", "Orders"],
    ["resolution", "Resolutions"],
    ["team", "Team"],
  ];
  const filtered = filter === "all" ? events : events.filter((event) => event.entity === filter);
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Audit log</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>A read-only history of sensitive Brand HQ actions and who performed them.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.auditFilters}>
        {options.map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.orderFilter, { borderColor: filter === id ? theme.accent : theme.lineColor, backgroundColor: filter === id ? theme.accent : theme.card }]}><Text style={[styles.orderFilterTxt, { color: filter === id ? theme.accentInk : theme.ink }]}>{label}</Text></Pressable>)}
      </ScrollView>
      {filtered.length ? filtered.slice(0, 100).map((event) => <View key={event.id} style={[styles.auditCard, { backgroundColor: theme.card, borderColor: theme.lineColor }]}><View style={styles.auditHead}><View style={[styles.auditDot, { backgroundColor: theme.accent }]} /><View style={{ flex: 1 }}><Text style={[styles.auditAction, { color: theme.ink }]}>{event.summary}</Text><Text style={[styles.auditMeta, { color: theme.muted }]}>{event.actorName} · {new Date(event.createdAt).toLocaleString()}</Text></View></View><Text style={[styles.auditEntity, { color: theme.muted }]}>{event.entity} · {event.entityName} · {event.action.replaceAll("_", " ")}</Text></View>) : <Empty text="No audit activity yet." theme={theme} styles={styles} />}
    </View>
  );
}

function SettingsSection({ brand, theme, styles }: { brand: Brand; theme: HQTheme; styles: ReturnType<typeof make> }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Settings</Text>
      <Text style={[styles.sectionP, { color: theme.muted }]}>Brand identity, legal details, market setup, and presentation.</Text>
      <ActionCard title="Brand Studio" copy="Edit the page, theme, analytics sharing, and inquiry routing." button="Open settings" onPress={() => router.push({ pathname: "/brand/studio", params: { id: brand.id } })} theme={theme} styles={styles} />
      <View style={[styles.detailCard, { backgroundColor: theme.card }]}>
        <Detail label="Legal owner" value={brand.legalName || brand.ownerName} theme={theme} styles={styles} />
        <Detail label="Registration" value={brand.registrationId || "Not provided"} theme={theme} styles={styles} />
        <Detail label="Primary market" value={brand.country} theme={theme} styles={styles} />
        <Detail label="Brand status" value={brand.verified ? "Verified" : brand.status} theme={theme} styles={styles} />
      </View>
    </View>
  );
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
    top: { flexDirection: "row", alignItems: "center", minHeight: 48 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    backTxt: { fontSize: 34, lineHeight: 36, marginTop: -4 },
    title: { color: theme.ink, fontSize: 24, fontWeight: "700", marginTop: 20 },
    topBrand: { flex: 1, alignItems: "center" },
    topSpacer: { width: 32 },
    topKicker: { fontSize: 9, letterSpacing: 1.6, fontWeight: "700" },
    topNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    topTitle: { fontSize: 17, fontWeight: "700" },
    hero: { borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", marginTop: 12 },
    logo: { width: 58, height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    logoTxt: { fontSize: 24, fontWeight: "800" },
    heroCopy: { flex: 1, paddingLeft: 14 },
    heroTitle: { fontFamily: "Georgia", fontSize: 25 },
    heroP: { fontSize: 13, lineHeight: 18, marginTop: 5 },
    nav: { gap: 8, paddingVertical: 18 },
    navChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: theme.lineColor, justifyContent: "center" },
    navTxt: { fontSize: 12, fontWeight: "700" },
    sectionKicker: { fontSize: 11, letterSpacing: 1.6, fontWeight: "700", marginTop: 4, marginBottom: 10 },
    sectionTitle: { fontFamily: "Georgia", fontSize: 27, marginTop: 10 },
    sectionP: { fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 14 },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stat: { width: "48%", borderRadius: 16, padding: 14 },
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
    marketKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "800", marginTop: 2 },
    marketSummary: { fontSize: 17, fontWeight: "800", marginTop: 5 },
    marketPicker: { gap: 8, paddingVertical: 10 },
    marketChip: { minWidth: 72, height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, justifyContent: "center" },
    marketChipCode: { fontSize: 12, fontWeight: "900" },
    marketChipName: { fontSize: 9, marginTop: 2 },
    marketHint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
    bulkCard: { borderRadius: 18, padding: 14, marginTop: 14 },
    bulkHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
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
    payoutSetup: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 10 },
    payoutSetupHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 9 },
    payoutLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 12, marginBottom: 5 },
    payoutTypeRow: { flexDirection: "row", gap: 8 },
    payoutTypeChip: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    payoutTypeText: { fontSize: 12, fontWeight: "800" },
    payoutInput: { height: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontSize: 13, marginTop: 11 },
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
    supportActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, marginTop: 10, flexWrap: "wrap" },
    supportNote: { minHeight: 54, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, fontSize: 12, textAlignVertical: "top" },
    noteButton: { alignSelf: "flex-end", borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, marginTop: 7 },
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
    detailCard: { borderRadius: 18, paddingHorizontal: 16, marginTop: 12 },
    detailRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", gap: 14 },
    detailLabel: { fontSize: 12 },
    detailValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "700" },
    empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 18, padding: 28, marginTop: 12, alignItems: "center" },
    emptyTxt: { fontSize: 14, textAlign: "center" },
  });
}
