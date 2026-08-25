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
import { useOrders } from "../../lib/orders";
import { pickAvatar, takeAvatar } from "../../lib/photo";
import { seedFromStyles, ARCH, PALS, SILS, dnaHint } from "../../lib/styleDna";
import { useUvel } from "../../lib/store";
import { pullLooks } from "../../lib/trends";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, likesOnMine, stampMine, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { draftProgress, useListingDraft, type ListingDraft } from "../../lib/listingDraft";

const W = Dimensions.get("window").width;
const COL = (W - 52) / 2;

type Hub = "shop" | "sold" | "purchases" | "likes";

export default function You() {
  const app = useUvel();
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
  const [dnaOpen, setDnaOpen] = useState(false);

  const listed = pieces.filter((p) => p.status === "listed" && (!p.ownerId || p.ownerId === app.uid));
  const soldPieces = pieces.filter((p) => p.status === "sold" && (!p.ownerId || p.ownerId === app.uid));
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

  function pick(patch: { archetype?: string; palette?: string; silhouette?: string }) {
    app.setStyle(patch);
    void pullLooks({ fresh: true });
  }

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
      tag: o.status === "failed" ? "Canceled" : "To ship",
      kind: o.status === "failed" ? "canceled" : "to_ship",
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
      tag: o.status === "failed" ? "Canceled" : "In progress",
      kind: o.status === "failed" ? "canceled" : "in_progress",
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
            {mine?.verified ? <VerifiedMark size={18} /> : null}
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
        <Pressable onPress={() => router.push("/settings")} style={styles.menuBtn} accessibilityLabel="Settings">
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
            <Pressable onPress={() => acceptInvite(inv.id, app.uid, app.displayName || "You", app.avatarUri || undefined)} style={styles.inviteYes}>
              <Text style={styles.inviteYesTxt}>Join</Text>
            </Pressable>
            <Pressable onPress={() => declineInvite(inv.id)} style={styles.inviteNo}>
              <Text style={styles.inviteNoTxt}>No</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {mine ? (
        <Pressable
          onPress={() => router.push({ pathname: "/brand/[id]", params: { id: mine.id } })}
          style={styles.brandCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.brandK}>{mine.verified ? "YOUR BRAND" : "IN REVIEW"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Text style={styles.brandName}>{mine.name}</Text>
              {mine.verified ? <VerifiedMark size={14} /> : null}
            </View>
            <Text style={styles.brandP}>{mine.verified ? "Page, listings, team, analysis" : "Waiting on verification"}</Text>
          </View>
          <Text style={styles.brandGo}>Open</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push("/brand/apply")} style={styles.brandCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandK}>BRANDS</Text>
            <Text style={styles.brandName}>Open a house</Text>
            <Text style={styles.brandP}>Verified brands post new fashion, not a closet.</Text>
          </View>
          <Text style={styles.brandGo}>Start</Text>
        </Pressable>
      )}

      {mine?.verified && canSeeAnalytics(mine, app.uid) ? (
        <Pressable onPress={() => router.push({ pathname: "/brand/analytics", params: { id: mine.id } })} style={styles.plan}>
          <View>
            <Text style={styles.planH}>Brand analysis</Text>
            <Text style={styles.planP}>Earnings, views, likes — owner desk</Text>
          </View>
          <Text style={styles.planGo}>See</Text>
        </Pressable>
      ) : null}

      {teams.map((b) => (
        <Pressable key={b.id} onPress={() => router.push({ pathname: "/brand/[id]", params: { id: b.id } })} style={styles.brandCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandK}>TEAM</Text>
            <Text style={styles.brandName}>{b.name}</Text>
            <Text style={styles.brandP}>You post on this house</Text>
          </View>
          <Text style={styles.brandGo}>Open</Text>
        </Pressable>
      ))}

      <Pressable onPress={() => setDnaOpen((v) => !v)} style={styles.dnaHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dnaTitle}>Style DNA</Text>
          <Text style={styles.dnaSum} numberOfLines={1}>
            {dnaReady
              ? [app.archetype, app.palette, app.silhouette].filter(Boolean).join("  ·  ")
              : "Set how Today picks looks"}
          </Text>
        </View>
        <Text style={[styles.dnaChevron, dnaOpen && styles.dnaChevronOpen]}>⌄</Text>
      </Pressable>
      {dnaOpen ? (
        <View style={styles.dnaBody}>
          <Text style={styles.lede}>
            This is how Uvel decides what you see on Today, and which pieces we put in front of you to buy.
          </Text>
          <ChipBlock
            label="Style"
            items={[...ARCH]}
            value={app.archetype}
            hint={app.archetype ? dnaHint("arch", app.archetype) : ""}
            onPick={(v) => pick({ archetype: v })}
          />
          <ChipBlock
            label="Palette"
            items={[...PALS]}
            value={app.palette}
            hint={app.palette ? dnaHint("pal", app.palette) : ""}
            onPick={(v) => pick({ palette: v })}
          />
          <ChipBlock
            label="Silhouette"
            items={[...SILS]}
            value={app.silhouette}
            hint={app.silhouette ? dnaHint("sil", app.silhouette) : ""}
            onPick={(v) => pick({ silhouette: v })}
          />
          <Text style={styles.foot}>
            {dnaReady
              ? "Today and Shop now pull looks that match this mix. Change it anytime."
              : "Pick a style to start. We’ll reshape Today around it."}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => router.push("/plus")} style={styles.plan}>
        <View>
          <Text style={styles.planH}>{app.isPlus ? "Uvel+" : "Free plan"}</Text>
          <Text style={styles.planP}>
            {app.isPlus
              ? `${app.plusPlan === "yearly" ? "Yearly" : "Monthly"} · unlimited try-on`
              : `${app.remainingFinds} finds · ${app.remainingTryOns} try-on left`}
          </Text>
        </View>
        {!app.isPlus ? <Text style={styles.planGo}>Get Uvel+</Text> : null}
      </Pressable>

      <View style={styles.tabs}>
        {(["shop", "sold", "purchases", "likes"] as const).map((id) => {
          const on = hub === id;
          const label = id === "shop" ? "Shop" : id === "sold" ? "Sold" : id === "purchases" ? "Purchases" : "Likes";
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
          styles={styles}
        />
      ) : hub === "purchases" ? (
        <BuyPane rows={buyRows} filter={buyFilter} setFilter={setBuyFilter} styles={styles} />
      ) : (
        <LikesPane
          received={likesOnMine(app.uid, app.saved, {
            uid: app.uid || "me",
            name: app.displayName || "You",
            photo: app.avatarUri || app.personUri || undefined,
          })}
          pieces={likedPieces}
          garments={likedGarments}
          styles={styles}
        />
      )}
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
  styles,
}: {
  rows: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string }[];
  filter: string;
  setFilter: (v: string) => void;
  earned: number;
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
        rows.map((r) => <OrderRow key={r.id} row={r} sold styles={styles} />)
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
  styles,
}: {
  rows: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string }[];
  filter: string;
  setFilter: (v: string) => void;
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
        rows.map((r) => <OrderRow key={r.id} row={r} styles={styles} />)
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
  if (!received.length && !pieces.length && !garments.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyH}>No likes yet</Text>
        <Text style={styles.emptyP}>When someone likes your listing, they show up here.</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.active}>Likes on your listings</Text>
      {received.length ? (
        received.map((row) => (
            <Pressable
              key={`${row.uid}-${row.piece.id}-${row.at}`}
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: row.piece.id } })}
              style={styles.liker}
            >
              {row.photo ? (
                <Image source={{ uri: row.photo }} style={styles.likerFace} contentFit="cover" />
              ) : (
                <View style={styles.likerFace}>
                  <Text style={styles.likerInit}>{(row.name[0] || "U").toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.likerName} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.likerP} numberOfLines={1}>
                  liked {row.piece.name}
                </Text>
                <Text style={styles.likerT}>{ago(row.at)}</Text>
              </View>
              <Image source={{ uri: row.piece.photo }} style={styles.likerThumb} contentFit="cover" />
            </Pressable>
        ))
      ) : (
        <Text style={styles.emptyP}>Nobody’s liked a listing yet.</Text>
      )}
      {pieces.length || garments.length ? (
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
              >
                <Image source={g.image} style={styles.likeImg} contentFit="cover" />
                <Text style={styles.likeName} numberOfLines={2}>
                  {g.name}
                </Text>
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
  styles,
}: {
  row: { id: string; pieceId: string; photo: string; name: string; cents: number; currency: string; tag: string };
  sold?: boolean;
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
      <View style={styles.tag}>
        <Text style={styles.tagTxt}>{row.tag}</Text>
      </View>
    </Pressable>
  );
}

function Rack() {
  return (
    <View style={art.rackWrap}>
      <View style={art.bar} />
      <View style={art.legL} />
      <View style={art.legR} />
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

function ChipBlock({
  label,
  items,
  value,
  hint,
  onPick,
}: {
  label: string;
  items: string[];
  value: string;
  hint: string;
  onPick: (v: string) => void;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={chip.meta}>{label}</Text>
      <View style={chip.wrap}>
        {items.map((item) => {
          const on = value === item;
          return (
            <Pressable key={item} onPress={() => onPick(item)} style={[chip.chip, on && chip.chipOn]}>
              <Text style={[chip.txt, on && chip.txtOn]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={chip.hint}>{hint}</Text> : null}
    </View>
  );
}

const chip = StyleSheet.create({
  meta: { color: "rgba(244,240,230,0.42)", fontSize: 12, marginBottom: 8, letterSpacing: 0.4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(244,240,230,0.14)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141310",
  },
  chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
  txt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
  txtOn: { color: "#16140F" },
  hint: { color: "rgba(244,240,230,0.38)", fontSize: 12, marginTop: 8 },
});

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

function make(_colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    content: { paddingHorizontal: 20 },
    kicker: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    title: { color: "#F4F0E6", fontWeight: "700", fontSize: 28, marginTop: 8, lineHeight: 34, flexShrink: 1 },
    ownerLine: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 4 },
    invite: { marginTop: 16, backgroundColor: "#161512", borderRadius: 18, padding: 16 },
    inviteH: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
    inviteP: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 4 },
    inviteRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    inviteYes: { height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: "#F4F0E6", alignItems: "center", justifyContent: "center" },
    inviteYesTxt: { color: "#16140F", fontWeight: "800", fontSize: 13 },
    inviteNo: { height: 34, paddingHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: "rgba(244,240,230,0.16)", alignItems: "center", justifyContent: "center" },
    inviteNoTxt: { color: "#F4F0E6", fontWeight: "700", fontSize: 13 },
    brandCard: {
      marginTop: 16,
      backgroundColor: "#161512",
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    brandK: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.4, fontSize: 10, fontWeight: "700" },
    brandName: { color: "#F4F0E6", fontWeight: "700", fontSize: 17 },
    brandP: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 4 },
    brandGo: { color: "#F4F0E6", fontWeight: "700", fontSize: 13 },
    top: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    faceBtn: { marginRight: 8, marginTop: 4 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1A1915" },
    initials: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#F4F0E6",
      alignItems: "center",
      justifyContent: "center",
    },
    initialsTxt: { color: "#16140F", fontWeight: "800", fontSize: 15 },
    faceDot: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    faceDotTxt: { color: "#16140F", fontSize: 13, fontWeight: "800", marginTop: -1 },
    menuBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 4,
    },
    dash: { width: 16, height: 1.5, borderRadius: 1, backgroundColor: "#F4F0E6" },
    h2: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26, marginTop: 22 },
    dnaHead: {
      marginTop: 22,
      backgroundColor: "#161512",
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    dnaTitle: { color: "#F4F0E6", fontWeight: "700", fontSize: 17 },
    dnaSum: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 4 },
    dnaChevron: { color: "rgba(244,240,230,0.55)", fontSize: 22, marginTop: -6 },
    dnaChevronOpen: { transform: [{ rotate: "180deg" }], marginTop: 4 },
    dnaBody: { paddingHorizontal: 2, paddingBottom: 4 },
    lede: { color: "rgba(244,240,230,0.58)", fontSize: 15, lineHeight: 22, marginTop: 12 },
    foot: { color: "rgba(244,240,230,0.4)", fontSize: 13, lineHeight: 19, marginTop: 16 },
    plan: {
      marginTop: 22,
      backgroundColor: "#161512",
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planH: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
    planP: { color: "rgba(244,240,230,0.5)", marginTop: 4, fontSize: 13 },
    planGo: { color: "#F4F0E6", fontWeight: "700", fontSize: 13 },
    tabs: {
      flexDirection: "row",
      marginTop: 28,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(244,240,230,0.12)",
    },
    tab: { flex: 1, alignItems: "center", paddingBottom: 12 },
    tabTxt: { color: "rgba(244,240,230,0.42)", fontSize: 15, fontWeight: "600" },
    tabOn: { color: "#F4F0E6" },
    tabLine: { position: "absolute", bottom: 0, height: 2, left: 8, right: 8, backgroundColor: "#F4F0E6", borderRadius: 1 },
    activeRow: { marginTop: 18, marginBottom: 8 },
    active: { color: "#F4F0E6", fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
    draftSection: { marginTop: 14 },
    draftHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    draftHint: { color: "#D6E27A", fontSize: 12, fontWeight: "600" },
    draftCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 18, backgroundColor: "#161512", marginTop: 2 },
    draftImg: { width: 82, height: 104, borderRadius: 12, backgroundColor: "#1A1915" },
    draftImgEmpty: { width: 82, height: 104, borderRadius: 12, backgroundColor: "#1A1915", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(244,240,230,0.24)", alignItems: "center", justifyContent: "center" },
    draftImgPlus: { color: "#F4F0E6", fontSize: 28 },
    draftMeta: { flex: 1, minWidth: 0 },
    draftTag: { alignSelf: "flex-start", paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: "#D6E27A", justifyContent: "center" },
    draftTagTxt: { color: "#16140F", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
    draftName: { color: "#F4F0E6", fontSize: 15, fontWeight: "700", marginTop: 7 },
    draftDetails: { color: "rgba(244,240,230,0.55)", fontSize: 12, marginTop: 4 },
    draftProgress: { color: "#D6E27A", fontSize: 12, fontWeight: "700", marginTop: 8 },
    draftArrow: { color: "#F4F0E6", fontSize: 30, marginRight: 4 },
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
    likerInit: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
    likerName: { color: "#F4F0E6", fontWeight: "700", fontSize: 15 },
    likerP: { color: "rgba(244,240,230,0.55)", fontSize: 13, marginTop: 2 },
    likerT: { color: "rgba(244,240,230,0.38)", fontSize: 12, marginTop: 2 },
    likerThumb: { width: 48, height: 64, borderRadius: 8, backgroundColor: "#1A1915" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
    empty: { alignItems: "center", paddingTop: 54, paddingBottom: 28, paddingHorizontal: 24 },
    emptyH: { color: "#F4F0E6", fontSize: 20, fontWeight: "800", textAlign: "center" },
    emptyP: { color: "rgba(244,240,230,0.55)", fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 21 },
    start: {
      marginTop: 22,
      height: 48,
      paddingHorizontal: 28,
      borderRadius: 24,
      backgroundColor: "#F4F0E6",
      alignItems: "center",
      justifyContent: "center",
    },
    startTxt: { color: "#16140F", fontWeight: "800", fontSize: 16 },
    chips: { gap: 8, paddingVertical: 16 },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 13 },
    chipTxtOn: { color: "#16140F" },
    earn: {
      alignSelf: "flex-start",
      marginTop: 16,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      backgroundColor: "#161512",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.14)",
      justifyContent: "center",
    },
    earnTxt: { color: "#F4F0E6", fontWeight: "700", fontSize: 13 },
    order: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    orderImg: { width: 64, height: 80, borderRadius: 10, backgroundColor: "#1A1915" },
    orderName: { color: "#F4F0E6", fontWeight: "600", fontSize: 15 },
    orderPrice: { color: "#F4F0E6", fontWeight: "700", marginTop: 4 },
    tag: {
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: "#161512",
      justifyContent: "center",
    },
    tagTxt: { color: "rgba(244,240,230,0.7)", fontSize: 11, fontWeight: "700" },
    likeCard: { backgroundColor: "#161512", borderRadius: 18, overflow: "hidden" },
    likeImg: { width: "100%", height: COL * 1.25, backgroundColor: "#1A1915" },
    likeName: { color: "#F4F0E6", fontWeight: "600", fontSize: 13, paddingHorizontal: 10, paddingTop: 10 },
    likePrice: { color: "#F4F0E6", fontWeight: "700", fontSize: 13, paddingHorizontal: 10, paddingBottom: 12, marginTop: 4 },
  });
}
