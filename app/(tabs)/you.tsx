import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { VerifiedMark } from "../../components/VerifiedMark";
import { GARMENTS, getGarment, usd } from "../../lib/catalog";
import {
  acceptInvite,
  canSeeAnalytics,
  declineInvite,
  memberBrands,
  ownedBrand,
  pendingInvitesFor,
  useBrands,
  useInvites,
} from "../../lib/brands";
import { useOrders, type Order } from "../../lib/orders";
import { pickAvatar, takeAvatar } from "../../lib/photo";
import { seedFromStyles } from "../../lib/styleDna";
import { useUvel } from "../../lib/store";
import { useCopy } from "../../lib/useCopy";
import { useColors, type Colors } from "../../lib/theme";
import { semanticStatus, statusToneFor } from "../../lib/status";
import { getPiece, likesOnMine, stampMine, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { draftProgress, useListingDraft, type ListingDraft } from "../../lib/listingDraft";

const W = Dimensions.get("window").width;
const COL = (W - 52) / 2;

type Hub = "shop" | "sold" | "purchases" | "likes";

function orderStatusLabel(order: Order) {
  const resolution = order.resolution;
  if (order.status === "failed" || order.fulfillmentStatus === "canceled") return { tag: order.refundStatus === "succeeded" ? "Canceled · Refunded" : "Canceled", kind: "canceled" };
  if (order.refundStatus === "processing") return { tag: "Refund processing", kind: "in_progress" };
  if (order.refundStatus === "succeeded") return { tag: "Refund complete", kind: "completed" };
  if (resolution?.status === "requested") return { tag: resolution.type === "return" ? "Return requested" : "Cancellation requested", kind: "in_progress" };
  if (resolution?.status === "approved") return { tag: resolution.type === "return" ? "Return approved" : "Cancellation approved", kind: "in_progress" };
  if (resolution?.status === "item_sent") return { tag: "Return sent", kind: "in_progress" };
  if (resolution?.status === "received") return { tag: "Refund processing", kind: "in_progress" };
  if (order.fulfillmentStatus === "delivered") return { tag: "Delivered", kind: "completed" };
  if (order.fulfillmentStatus === "returned") return { tag: "Returned", kind: "canceled" };
  if (order.fulfillmentStatus === "shipped") return { tag: "Shipped", kind: "to_ship" };
  if (order.fulfillmentStatus === "packed") return { tag: "Packed", kind: "to_ship" };
  if (order.fulfillmentStatus === "processing") return { tag: "Processing", kind: "to_ship" };
  return order.status === "pending" ? { tag: "Payment pending", kind: "to_ship" } : { tag: "To process", kind: "to_ship" };
}

export default function You() {
  const app = useUvel();
  const C = useCopy();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const { draft } = useListingDraft();
  const orders = useOrders();
  useBrands();
  useInvites();
  const mine = ownedBrand(app.uid);
  const teams = memberBrands(app.uid).filter((b) => b.ownerId !== app.uid);
  const invites = pendingInvitesFor(app.uid, app.email);
  const [hub, setHub] = useState<Hub>("shop");
  const [soldFilter, setSoldFilter] = useState("all");
  const [buyFilter, setBuyFilter] = useState("all");

  const listed = pieces.filter((p) => p.status === "listed" && Boolean(app.uid) && p.ownerId === app.uid);
  const soldPieces = pieces.filter((p) => p.status === "sold" && Boolean(app.uid) && p.ownerId === app.uid);
  const soldOrders = orders.filter((o) => o.sellerId === app.uid);
  const buyOrders = orders.filter((o) => o.buyerId === app.uid);
  const likedPieces = app.saved.map((id) => getPiece(id)).filter(Boolean) as ClosetPiece[];
  const likedGarments = app.saved.map((id) => getGarment(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));

  useEffect(() => {
    if (app.archetype || !app.styles.length) return;
    const seed = seedFromStyles(app.styles);
    if (seed.archetype || seed.palette || seed.silhouette) app.setStyle(seed);
  }, [app.archetype, app.styles]);

  useEffect(() => {
    if (!app.hydrated) return;
    app.seedSavedLikes();
  }, [app.hydrated, app.saved.join("|"), pieces.length]);

  const dnaReady = Boolean(app.archetype || app.palette || app.silhouette);
  const initials = (app.displayName || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const face = app.avatarUri || app.personUri;

  async function setFace(uri: string | null) {
    if (!uri) return;
    app.setAvatar(uri);
    stampMine(app.uid, { ownerPhoto: uri, ownerName: app.displayName || undefined, ownerId: app.uid || undefined });
  }

  function changeFace() {
    Alert.alert("Profile picture", "Buyers see this on your listings.", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => void takeAvatar().then(setFace).catch(() => undefined) },
      { text: "Choose photo", onPress: () => void pickAvatar().then(setFace).catch(() => undefined) },
    ]);
  }
  const earned = soldPieces.reduce((n, p) => n + (p.listPriceCents || 0), 0) + soldOrders.reduce((n, o) => n + o.itemCents, 0);

  const soldRows = useMemo(() => {
    const fromOrders = soldOrders.map((o) => ({
      id: o.id,
      pieceId: o.pieceId,
      photo: o.piecePhoto,
      name: o.pieceName,
      cents: o.itemCents,
      currency: o.currency,
      ...orderStatusLabel(o),
    }));
    const fromPieces = soldPieces.map((p) => ({
      id: p.id,
      pieceId: p.id,
      photo: p.photo,
      name: p.name,
      cents: p.listPriceCents,
      currency: p.currency || "USD",
      tag: "Completed",
      kind: "completed",
    }));
    const all = [...fromOrders, ...fromPieces];
    if (soldFilter === "all") return all;
    return all.filter((r) => r.kind === soldFilter);
  }, [soldOrders, soldPieces, soldFilter]);

  const buyRows = useMemo(() => {
    const all = buyOrders.map((o) => ({
      id: o.id,
      pieceId: o.pieceId,
      photo: o.piecePhoto,
      name: o.pieceName,
      cents: o.totalCents,
      currency: o.currency,
      ...orderStatusLabel(o),
    }));
    if (buyFilter === "all") return all;
    return all.filter((r) => r.kind === buyFilter);
  }, [buyOrders, buyFilter]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 108 }]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.title}>{app.displayName || "Your closet"}</Text>
            {mine?.verified && mine.logoUri ? <Image source={{ uri: mine.logoUri }} style={styles.ownerBrandLogo} contentFit="cover" /> : null}
          </View>
          {mine ? (
            <Text style={styles.ownerLine}>{mine.verified ? `Owner of ${mine.name}` : `Filing for ${mine.name}`}</Text>
          ) : teams[0] ? (
            <Text style={styles.ownerLine}>Team at {teams[0].name}</Text>
          ) : null}
        </View>
        <Pressable onPress={changeFace} style={styles.faceBtn} accessibilityLabel="Change profile picture">
          {face ? (
            <Image source={{ uri: face }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.initials}>
              <Text style={styles.initialsTxt}>{initials}</Text>
            </View>
          )}
          <View style={styles.faceDot}>
            <Text style={styles.faceDotTxt}>+</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} style={styles.menuBtn} accessibilityLabel={C.settings}>
          <View style={styles.dash} />
          <View style={styles.dash} />
          <View style={styles.dash} />
        </Pressable>
      </View>

      {invites.map((inv) => (
        <View key={inv.id} style={styles.invite}>
          <Text style={styles.inviteH}>{inv.brandName}</Text>
          <Text style={styles.inviteP}>{inv.fromName} invited you to post on this brand.</Text>
          <View style={styles.inviteRow}>
            <Pressable onPress={() => void acceptInvite(inv.id, app.uid, app.displayName || "You", app.avatarUri || undefined).catch((error) => Alert.alert("Couldn’t join brand", error instanceof Error ? error.message : "Try again in a moment."))} style={styles.inviteYes}>
              <Text style={styles.inviteYesTxt}>Join</Text>
            </Pressable>
            <Pressable onPress={() => declineInvite(inv.id)} style={styles.inviteNo}>
              <Text style={styles.inviteNoTxt}>No</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>NEXT UP</Text>
      <Pressable
        onPress={() => mine ? router.push({ pathname: "/brand/[id]", params: { id: mine.id } }) : router.push("/brand/apply")}
        style={styles.nextCard}
        accessibilityRole="button"
        accessibilityLabel={mine ? `Open ${mine.name} brand status` : "Start a public brand application"}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.nextK}>{mine ? (mine.verified ? "UVEL-REVIEWED" : mine.reviewStatus === "needs_information" ? "ACTION NEEDED" : "IN REVIEW") : "YOUR NEXT STEP"}</Text>
          <Text style={styles.nextTitle}>{mine ? mine.name : "Start your brand"}</Text>
          <Text style={styles.nextP}>{mine ? (mine.verified ? "Your page, listings, and team are ready." : mine.reviewStatus === "needs_information" ? "Add the missing details, then submit again." : "Your workspace is ready while Uvel reviews the brand.") : "Apply publicly when you are ready to post."}</Text>
        </View>
        <Text style={styles.nextAction}>{mine ? (mine.reviewStatus === "needs_information" ? "Fix" : "Open") : "Start"}</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>YOUR ACTIVITY</Text>
      <View style={styles.tabs}>
        {(["shop", "sold", "purchases", "likes"] as const).map((id) => {
          const on = hub === id;
          const label = id === "shop" ? C.shop : id === "sold" ? C.sold : id === "purchases" ? C.purchases : C.likes;
          return (
            <Pressable key={id} onPress={() => setHub(id)} style={styles.tab}>
              <Text style={[styles.tabTxt, on && styles.tabOn]}>{label}</Text>
              {on ? <View style={styles.tabLine} /> : null}
            </Pressable>
          );
        })}
      </View>

      {hub === "shop" ? (
        <ShopPane listed={listed} draft={draft} styles={styles} />
      ) : hub === "sold" ? (
        <SoldPane
          rows={soldRows}
          filter={soldFilter}
          setFilter={setSoldFilter}
          earned={earned}
          colors={colors}
          styles={styles}
        />
      ) : hub === "purchases" ? (
        <BuyPane rows={buyRows} filter={buyFilter} setFilter={setBuyFilter} colors={colors} styles={styles} />
      ) : (
        <LikesPane
          received={likesOnMine(app.uid)}
          pieces={likedPieces}
          garments={likedGarments}
          styles={styles}
        />
      )}

      <Text style={[styles.sectionLabel, { marginTop: 30 }]}>TOOLS & PREFERENCES</Text>
      <Pressable onPress={() => router.push("/style-dna")} style={styles.toolRow} accessibilityRole="button" accessibilityLabel={`Style DNA${dnaReady ? `: ${[app.archetype, app.palette, app.silhouette].filter(Boolean).join(", ")}` : ": not set"}`}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dnaTitle}>Style DNA</Text>
          <Text style={styles.dnaSum} numberOfLines={1}>{dnaReady ? [app.archetype, app.palette, app.silhouette].filter(Boolean).join("  ·  ") : "Set how your picks look on the Today page"}</Text>
        </View>
        <Text style={styles.dnaChevron}>›</Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>BRAND WORKSPACE</Text>
      {mine ? (
        <View style={styles.brandCard}>
          <Pressable onPress={() => router.push({ pathname: "/brand/[id]", params: { id: mine.id } })} style={styles.brandCardMain} accessibilityRole="button" accessibilityLabel={`View ${mine.name} brand page`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandK}>PUBLIC PAGE</Text>
              <Text style={styles.brandName}>{mine.name}</Text>
              <Text style={styles.brandP}>View the public brand page.</Text>
            </View>
            <Text style={styles.brandGo}>View</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/brand/hq", params: { id: mine.id } })} style={styles.brandHQButton} accessibilityRole="button" accessibilityLabel={`Manage ${mine.name} brand`}>
            <Text style={styles.brandHQText}>Manage</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={() => router.push("/brand/founder")} style={styles.toolRow} accessibilityRole="button" accessibilityLabel="Open private Founder Studio">
        <View style={{ flex: 1 }}>
          <Text style={styles.brandK}>OPTIONAL WORKSPACE</Text>
          <Text style={styles.brandName}>Founder Studio</Text>
          <Text style={styles.brandP}>{mine ? "Building another brand? Plan it privately before applying." : "Sketch, plan, source, and prepare before applying publicly."}</Text>
        </View>
        <Text style={styles.brandGo}>Open</Text>
      </Pressable>

      {mine?.verified && canSeeAnalytics(mine, app.uid) ? (
        <Pressable onPress={() => router.push({ pathname: "/brand/analytics", params: { id: mine.id } })} style={styles.toolRow}>
          <View><Text style={styles.planH}>Brand analysis</Text><Text style={styles.planP}>Earnings, views, likes</Text></View><Text style={styles.planGo}>View</Text>
        </Pressable>
      ) : null}
      <>
        <Pressable onPress={() => router.push("/seller-analytics")} style={styles.toolRow} accessibilityRole="button" accessibilityLabel="Open seller analytics"><View><Text style={styles.planH}>Seller analytics</Text><Text style={styles.planP}>Listing signals and order records</Text></View><Text style={styles.planGo}>View</Text></Pressable>
        <Pressable onPress={() => router.push("/alerts")} style={styles.toolRow} accessibilityRole="button" accessibilityLabel="Open price and restock alerts"><View><Text style={styles.planH}>Price & restock alerts</Text><Text style={styles.planP}>Watch the saved pieces you care about</Text></View><Text style={styles.planGo}>View</Text></Pressable>
      </>
      {teams.map((b) => (
        <Pressable key={b.id} onPress={() => router.push({ pathname: "/brand/[id]", params: { id: b.id } })} style={styles.toolRow}>
          <View style={{ flex: 1 }}><Text style={styles.brandK}>TEAM</Text><Text style={styles.brandName}>{b.name}</Text><Text style={styles.brandP}>You post on this house</Text></View><Text style={styles.brandGo}>Open</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ShopPane({ listed, draft, styles }: { listed: ClosetPiece[]; draft: ListingDraft | null; styles: ReturnType<typeof make> }) {
  return (
    <View>
      {draft ? (
        <View style={styles.draftSection}>
          <View style={styles.draftHead}>
            <Text style={styles.active}>Drafts (1)</Text>
            <Text style={styles.draftHint}>Tap to continue</Text>
          </View>
          <DraftCard draft={draft} styles={styles} />
        </View>
      ) : null}
      <View style={styles.activeRow}>
        <Text style={styles.active}>Active ({listed.length} listing{listed.length === 1 ? "" : "s"})</Text>
      </View>
      {listed.length ? (
        <View style={styles.grid}>
          {listed.map((p) => (
            <View key={p.id} style={{ width: COL }}>
              <ListingCard piece={p} framed wide={COL} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Rack />
          <Text style={styles.emptyH}>No active listings</Text>
          <Text style={styles.emptyP}>List an item so buyers can discover your shop.</Text>
          <Pressable onPress={() => router.push("/sell")} style={styles.start}>
            <Text style={styles.startTxt}>Start selling</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DraftCard({ draft, styles }: { draft: ListingDraft; styles: ReturnType<typeof make> }) {
  const photo = draft.photos[0]?.uri;
  const title = draft.name.trim() || "Untitled listing";
  const details = [draft.category, draft.size, draft.condition].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={() => router.push({ pathname: "/sell", params: { draft: "1" } })} style={styles.draftCard}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.draftImg} contentFit="cover" />
      ) : (
        <View style={styles.draftImgEmpty}>
          <Text style={styles.draftImgPlus}>＋</Text>
        </View>
      )}
      <View style={styles.draftMeta}>
        <View style={styles.draftTag}>
          <Text style={styles.draftTagTxt}>Draft</Text>
        </View>
        <Text style={styles.draftName} numberOfLines={2}>{title}</Text>
        <Text style={styles.draftDetails} numberOfLines={1}>{details || "Listing details not finished"}</Text>
        <Text style={styles.draftProgress}>{draftProgress(draft)}</Text>
      </View>
      <Text style={styles.draftArrow}>›</Text>
    </Pressable>
  );
}

function SoldPane({
  rows,
  filter,
  setFilter,
  earned,
  colors,
  styles,
}: {
  rows: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string; kind: string }[];
  filter: string;
  setFilter: (v: string) => void;
  earned: number;
  colors: Colors;
  styles: ReturnType<typeof make>;
}) {
  return (
    <View>
      {earned > 0 ? (
        <View style={styles.earn}>
          <Text style={styles.earnTxt}>Earnings  {usd(earned)}</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[
          ["all", "All"],
          ["to_ship", "To ship"],
          ["in_transit", "In transit"],
          ["canceled", "Canceled"],
          ["completed", "Completed"],
        ].map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => setFilter(id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {rows.length ? (
        rows.map((r) => <OrderRow key={r.id} row={r} sold colors={colors} styles={styles} />)
      ) : (
        <View style={styles.empty}>
          <Stack />
          <Text style={styles.emptyP}>Your sales will show up here</Text>
        </View>
      )}
    </View>
  );
}

function BuyPane({
  rows,
  filter,
  setFilter,
  colors,
  styles,
}: {
  rows: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string; kind: string }[];
  filter: string;
  setFilter: (v: string) => void;
  colors: Colors;
  styles: ReturnType<typeof make>;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[
          ["all", "All"],
          ["in_progress", "In progress"],
          ["canceled", "Canceled"],
          ["completed", "Completed"],
        ].map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => setFilter(id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {rows.length ? (
        rows.map((r) => <OrderRow key={r.id} row={r} colors={colors} styles={styles} />)
      ) : (
        <View style={styles.empty}>
          <Receipt />
          <Text style={styles.emptyP}>Your orders will show up here</Text>
        </View>
      )}
    </View>
  );
}

function ago(ms: number) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function LikesPane({
  received,
  pieces,
  garments,
  styles,
}: {
  received: ReturnType<typeof likesOnMine>;
  pieces: ClosetPiece[];
  garments: (typeof GARMENTS)[number][];
  styles: ReturnType<typeof make>;
}) {
  const hasSaved = pieces.length > 0 || garments.length > 0;
  if (!received.length && !hasSaved) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyH}>No likes yet</Text>
        <Text style={styles.emptyP}>Items you save appear here. Likes on your own listings will appear when someone likes them.</Text>
      </View>
    );
  }
  return (
    <View>
      {received.length ? (
        <>
          <Text style={styles.active}>Likes on your listings</Text>
          {received.map((row) => (
            <Pressable
              key={`${row.uid}-${row.piece.id}-${row.at}`}
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: row.piece.id } })}
              style={styles.liker}
              accessibilityRole="button"
              accessibilityLabel={`${row.name} liked ${row.piece.name}`}
            >
              {row.photo ? (
                <Image source={{ uri: row.photo }} style={styles.likerFace} contentFit="cover" />
              ) : (
                <View style={styles.likerFace}>
                  <Text style={styles.likerInit}>{(row.name[0] || "U").toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.likerName} numberOfLines={1}>{row.name}</Text>
                <Text style={styles.likerP} numberOfLines={1}>liked {row.piece.name}</Text>
                <Text style={styles.likerT}>{ago(row.at)}</Text>
              </View>
              <Image source={{ uri: row.piece.photo }} style={styles.likerThumb} contentFit="cover" />
            </Pressable>
          ))}
        </>
      ) : null}
      {hasSaved ? (
        <View>
          <Text style={styles.active}>You liked</Text>
          <View style={styles.grid}>
            {pieces.map((p) => (
              <View key={p.id} style={{ width: COL }}>
                <ListingCard piece={p} framed wide={COL} />
              </View>
            ))}
            {garments.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: g.id } })}
                style={[styles.likeCard, { width: COL }]}
                accessibilityRole="button"
                accessibilityLabel={`Open liked item ${g.name}`}
              >
                <Image source={g.image} style={styles.likeImg} contentFit="cover" />
                <Text style={styles.likeName} numberOfLines={2}>{g.name}</Text>
                <Text style={styles.likePrice}>{usd(g.priceCents)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function OrderRow({
  row,
  sold,
  colors,
  styles,
}: {
  row: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string; kind: string };
  sold?: boolean;
  colors: Colors;
  styles: ReturnType<typeof make>;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: sold ? "/closet/[id]" : "/order/[id]",
          params: { id: sold ? row.pieceId : row.id },
        })
      }
      style={styles.order}
    >
      {row.photo ? <Image source={{ uri: row.photo }} style={styles.orderImg} contentFit="cover" /> : <View style={styles.orderImg} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.orderName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.orderPrice}>{usd(row.cents, row.currency)}</Text>
      </View>
      <View style={[styles.tag, { backgroundColor: semanticStatus(colors, statusToneFor(row.kind)).backgroundColor, borderColor: semanticStatus(colors, statusToneFor(row.kind)).borderColor, borderWidth: 1 }]}>
        <Text style={[styles.tagTxt, { color: semanticStatus(colors, statusToneFor(row.kind)).color }]}>{row.tag}</Text>
      </View>
    </Pressable>
  );
}

function Rack() {
  const colors = useColors();
  const rackColor = `${colors.bone}8C`;
  return (
    <View style={art.rackWrap}>
      <View style={[art.bar, { backgroundColor: rackColor }]} />
      <View style={[art.legL, { backgroundColor: `${colors.bone}73` }]} />
      <View style={[art.legR, { backgroundColor: `${colors.bone}73` }]} />
      <View style={art.hangerHook} />
      <View style={art.hanger} />
    </View>
  );
}

function Stack() {
  return (
    <View style={art.stack}>
      <View style={[art.fold, { backgroundColor: "#C45C3C", transform: [{ rotate: "-6deg" }] }]} />
      <View style={[art.fold, { backgroundColor: "#3D5A80", marginTop: -18, transform: [{ rotate: "4deg" }] }]} />
      <View style={[art.fold, { backgroundColor: "#E8E0D4", marginTop: -18 }]} />
    </View>
  );
}

function Receipt() {
  return (
    <View style={art.receipt}>
      <View style={art.line} />
      <View style={[art.line, { width: 54 }]} />
      <View style={[art.line, { width: 70, marginTop: 10 }]} />
      <View style={[art.line, { width: 48 }]} />
      <View style={[art.line, { width: 62 }]} />
      <View style={art.bars} />
    </View>
  );
}

const art = StyleSheet.create({
  rackWrap: { width: 120, height: 110, marginBottom: 18 },
  bar: { position: "absolute", top: 8, left: 8, right: 8, height: 6, borderRadius: 3, backgroundColor: "rgba(244,240,230,0.55)" },
  legL: { position: "absolute", top: 8, left: 10, width: 6, height: 92, borderRadius: 3, backgroundColor: "rgba(244,240,230,0.45)" },
  legR: { position: "absolute", top: 8, right: 10, width: 6, height: 92, borderRadius: 3, backgroundColor: "rgba(244,240,230,0.45)" },
  hangerHook: { position: "absolute", top: 22, left: 56, width: 8, height: 16, borderRadius: 4, backgroundColor: "#C45C3C" },
  hanger: { position: "absolute", top: 36, left: 28, width: 64, height: 8, borderRadius: 4, backgroundColor: "#C4A574" },
  stack: { width: 90, height: 70, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  fold: { width: 78, height: 22, borderRadius: 6 },
  receipt: {
    width: 72,
    height: 110,
    backgroundColor: "#F4F0E6",
    borderRadius: 4,
    padding: 10,
    marginBottom: 18,
    alignItems: "center",
  },
  line: { height: 3, width: 44, backgroundColor: "rgba(22,20,15,0.18)", borderRadius: 2, marginTop: 6 },
  bars: { marginTop: 14, width: 40, height: 10, backgroundColor: "rgba(22,20,15,0.55)" },
});

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20 },
    kicker: { color: `${colors.bone}6B`, letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    title: { color: colors.bone, fontWeight: "700", fontSize: 28, marginTop: 8, lineHeight: 34, flexShrink: 1 },
    ownerBrandLogo: { width: 19, height: 19, borderRadius: 5, marginLeft: 1, transform: [{ translateY: 3 }] },
    ownerLine: { color: `${colors.bone}80`, fontSize: 13, marginTop: 4 },
    invite: { marginTop: 16, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
    inviteH: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    inviteP: { color: `${colors.bone}80`, fontSize: 13, marginTop: 4 },
    inviteRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    inviteYes: { height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" },
    inviteYesTxt: { color: colors.successInk, fontWeight: "800", fontSize: 13 },
    inviteNo: { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}29`, alignItems: "center", justifyContent: "center" },
    inviteNoTxt: { color: colors.bone, fontWeight: "700", fontSize: 13 },
    brandArea: { marginBottom: 8 },
    sectionLabel: { color: `${colors.bone}6B`, letterSpacing: 1.6, fontSize: 10, fontWeight: "800", marginTop: 22, marginBottom: 9 },
    brandAreaLabel: { color: `${colors.bone}6B`, letterSpacing: 1.6, fontSize: 10, fontWeight: "800", marginTop: 10, marginBottom: 9 },
    brandCard: {
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    brandK: { color: `${colors.bone}6B`, letterSpacing: 1.4, fontSize: 10, fontWeight: "700" },
    brandName: { color: colors.bone, fontWeight: "700", fontSize: 17 },
    brandP: { color: `${colors.bone}80`, fontSize: 13, marginTop: 4 },
    brandGo: { color: colors.bone, fontWeight: "700", fontSize: 13 },
    brandCardMain: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
    brandHQButton: { marginLeft: 12, minWidth: 44, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" },
    brandHQText: { color: colors.successInk, fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
    top: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    faceBtn: { marginRight: 8, marginTop: 4 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface },
    initials: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    initialsTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
    faceDot: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    faceDotTxt: { color: colors.successInk, fontSize: 13, fontWeight: "800", marginTop: -1 },
    menuBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: `${colors.bone}29`,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 4,
    },
    dash: { width: 16, height: 1.5, borderRadius: 1, backgroundColor: colors.bone },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 26, marginTop: 22 },
    nextCard: { marginTop: 2, backgroundColor: colors.surface, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: `${colors.bone}29` },
    nextK: { color: `${colors.bone}85`, letterSpacing: 1.4, fontSize: 10, fontWeight: "800" },
    nextTitle: { color: colors.bone, fontWeight: "800", fontSize: 19, marginTop: 4 },
    nextP: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
    nextAction: { color: colors.success, fontWeight: "800", fontSize: 13 },
    dnaHead: {
      marginTop: 0,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toolRow: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    upgradeRow: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    focused: { borderWidth: 2, borderColor: colors.success },
    dnaTitle: { color: colors.bone, fontWeight: "700", fontSize: 17 },
    dnaSum: { color: `${colors.bone}80`, fontSize: 13, marginTop: 4 },
    dnaChevron: { color: `${colors.bone}8C`, fontSize: 22, marginTop: -6 },
    lede: { color: `${colors.bone}94`, fontSize: 15, lineHeight: 22, marginTop: 12 },
    foot: { color: `${colors.bone}66`, fontSize: 13, lineHeight: 19, marginTop: 16 },
    plan: {
      marginTop: 10,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planH: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    planP: { color: `${colors.bone}80`, marginTop: 4, fontSize: 13 },
    planGo: { color: colors.bone, fontWeight: "700", fontSize: 13 },
    tabs: {
      flexDirection: "row",
      marginTop: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colors.bone}1F`,
    },
    tab: { flex: 1, alignItems: "center", paddingBottom: 12 },
    tabTxt: { color: `${colors.bone}6B`, fontSize: 15, fontWeight: "600" },
    tabOn: { color: colors.bone },
    tabLine: { position: "absolute", bottom: 0, height: 2, left: 8, right: 8, backgroundColor: colors.bone, borderRadius: 1 },
    activeRow: { marginTop: 18, marginBottom: 8 },
    active: { color: colors.bone, fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
    draftSection: { marginTop: 14 },
    draftHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    draftHint: { color: colors.warning, fontSize: 12, fontWeight: "600" },
    draftCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 18, backgroundColor: colors.surface, marginTop: 2 },
    draftImg: { width: 82, height: 104, borderRadius: 12, backgroundColor: colors.surface },
    draftImgEmpty: { width: 82, height: 104, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderStyle: "dashed", borderColor: `${colors.bone}3D`, alignItems: "center", justifyContent: "center" },
    draftImgPlus: { color: colors.bone, fontSize: 28 },
    draftMeta: { flex: 1, minWidth: 0 },
    draftTag: { alignSelf: "flex-start", paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: colors.warning, justifyContent: "center" },
    draftTagTxt: { color: colors.warningInk, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
    draftName: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 7 },
    draftDetails: { color: `${colors.bone}8C`, fontSize: 12, marginTop: 4 },
    draftProgress: { color: colors.warning, fontSize: 12, fontWeight: "700", marginTop: 8 },
    draftArrow: { color: colors.bone, fontSize: 30, marginRight: 4 },
    liker: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 12,
    },
    likerFace: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#2A2824",
      alignItems: "center",
      justifyContent: "center",
    },
    likerInit: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    likerName: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    likerP: { color: `${colors.bone}8C`, fontSize: 13, marginTop: 2 },
    likerT: { color: `${colors.bone}61`, fontSize: 12, marginTop: 2 },
    likerThumb: { width: 48, height: 64, borderRadius: 8, backgroundColor: colors.surface },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
    empty: { alignItems: "center", paddingTop: 54, paddingBottom: 28, paddingHorizontal: 24 },
    emptyH: { color: colors.bone, fontSize: 20, fontWeight: "800", textAlign: "center" },
    emptyP: { color: `${colors.bone}8C`, fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 21 },
    start: {
      marginTop: 22,
      height: 48,
      paddingHorizontal: 28,
      borderRadius: 24,
      backgroundColor: colors.bone,
      alignItems: "center",
      justifyContent: "center",
    },
    startTxt: { color: colors.successInk, fontWeight: "800", fontSize: 16 },
    chips: { gap: 8, paddingVertical: 16 },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${colors.bone}2E`,
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: colors.bone, borderColor: colors.bone },
    chipTxt: { color: colors.bone, fontWeight: "600", fontSize: 13 },
    chipTxtOn: { color: colors.successInk },
    earn: {
      alignSelf: "flex-start",
      marginTop: 16,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: `${colors.bone}24`,
      justifyContent: "center",
    },
    earnTxt: { color: colors.bone, fontWeight: "700", fontSize: 13 },
    order: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    orderImg: { width: 64, height: 80, borderRadius: 10, backgroundColor: colors.surface },
    orderName: { color: colors.bone, fontWeight: "600", fontSize: 15 },
    orderPrice: { color: colors.bone, fontWeight: "700", marginTop: 4 },
    tag: {
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: colors.surface,
      justifyContent: "center",
    },
    tagTxt: { color: `${colors.bone}B2`, fontSize: 11, fontWeight: "700" },
    likeCard: { backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" },
    likeImg: { width: "100%", height: COL * 1.25, backgroundColor: colors.surface },
    likeName: { color: colors.bone, fontWeight: "600", fontSize: 13, paddingHorizontal: 10, paddingTop: 10 },
    likePrice: { color: colors.bone, fontWeight: "700", fontSize: 13, paddingHorizontal: 10, paddingBottom: 12, marginTop: 4 },
  });
}
