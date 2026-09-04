import { StyleSheet, Text, View } from "react-native";
import { uvelFeeCents } from "../lib/fees";
import { getMarket, moneyInMarket, type Market } from "../lib/markets";

type PricePreviewProps = {
  listingCents: number;
  currency: string;
  market?: Market;
  compact?: boolean;
};

export function PricePreview({ listingCents, currency, market = getMarket(), compact = false }: PricePreviewProps) {
  const fee = listingCents > 0 ? uvelFeeCents(listingCents, currency, market) : 0;
  const styles = makeStyles(compact);
  return (
    <View style={styles.box} accessibilityLabel="Price preview">
      <Text style={styles.heading}>Price preview</Text>
      <PriceRow label="Listing price" value={listingCents > 0 ? moneyInMarket(listingCents, currency, market) : "—"} styles={styles} />
      <PriceRow label="Buyer protection fee" value={fee > 0 ? moneyInMarket(fee, market.currency, market) : "—"} styles={styles} />
      <View style={styles.divider} />
      <PriceRow label="Seller receives" value={listingCents > 0 ? moneyInMarket(listingCents, currency, market) : "—"} styles={styles} emphasis />
      <Text style={styles.note}>The seller receives the full listing price. Buyer protection is added at checkout.</Text>
    </View>
  );
}

function PriceRow({ label, value, styles, emphasis = false }: { label: string; value: string; styles: ReturnType<typeof makeStyles>; emphasis?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, emphasis && styles.emphasis]}>{label}</Text>
      <Text style={[styles.value, emphasis && styles.emphasis]}>{value}</Text>
    </View>
  );
}

function makeStyles(compact: boolean) {
  return StyleSheet.create({
    box: { marginTop: compact ? 10 : 16, padding: compact ? 12 : 16, borderRadius: 16, backgroundColor: "rgba(128,128,128,0.10)", borderWidth: 1, borderColor: "rgba(128,128,128,0.20)" },
    heading: { color: "#F4F0E6", fontSize: compact ? 12 : 14, fontWeight: "800", marginBottom: 8 },
    row: { minHeight: compact ? 25 : 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    label: { color: "rgba(244,240,230,0.66)", fontSize: compact ? 12 : 13, flex: 1 },
    value: { color: "#F4F0E6", fontSize: compact ? 12 : 13, fontVariant: ["tabular-nums"], textAlign: "right" },
    emphasis: { color: "#D6E27A", fontWeight: "800" },
    divider: { height: 1, backgroundColor: "rgba(244,240,230,0.16)", marginVertical: 5 },
    note: { color: "rgba(244,240,230,0.52)", fontSize: 11, lineHeight: 16, marginTop: 8 },
  });
}
