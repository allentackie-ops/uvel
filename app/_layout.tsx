import { DarkTheme, Stack, ThemeProvider, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LaunchSplash } from "../components/LaunchSplash";
import { ShakeToReport } from "../components/ShakeToReport";
import { observeListing } from "../lib/alerts";
import { useOtaReady } from "../lib/ota";
import { armNotificationHandler, registerPushToken, watchLastSeen } from "../lib/push";
import { syncEngagement } from "../lib/engagement";
import { useCart } from "../lib/cart";
import { useFirstFind } from "../lib/firstFind";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance } from "../lib/theme";
import { useCopy } from "../lib/useCopy";
import { pullLooks } from "../lib/trends";
import { useWardrobe } from "../lib/wardrobe";
import { watchMyOrders } from "../lib/orders";
import { consumeListingDraftNotice } from "../lib/listingDraft";
import { armFounderDesk, founderDeskRoute, getFounderDeskJob, revealFounderDesk } from "../lib/founderDesk";
import { FounderDeskNotice } from "../components/FounderDeskNotice";
import Onboard from "./onboard";
import ProfileSetup from "./setup";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function OrderSync() {
  const { uid } = useUvel();
  useEffect(() => watchMyOrders(uid), [uid]);
  return null;
}

function LikesSync() {
  const app = useUvel();
  const pieces = useWardrobe();
  useEffect(() => {
    if (!app.hydrated || !pieces.length) return;
    app.seedSavedLikes();
  }, [app.hydrated, pieces.length, app.saved.join("|")]);
  return null;
}

function AlertSync() {
  const { uid } = useUvel();
  const pieces = useWardrobe();
  const observed = useRef(new Map<string, string>());
  useEffect(() => {
    observed.current.clear();
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    for (const piece of pieces) {
      const stock = typeof piece.stockQuantity === "number" ? piece.stockQuantity : piece.sizeStock ? Object.values(piece.sizeStock).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) : "none";
      const signature = `${piece.listPriceCents}:${stock}:${piece.status}`;
      if (observed.current.get(piece.id) === signature) continue;
      observed.current.set(piece.id, signature);
      void observeListing(uid, piece);
    }
  }, [uid, pieces]);
  return null;
}

function PushSync() {
  const app = useUvel();
  const uid = app.uid;
  const cart = useCart();
  const find = useFirstFind();
  useEffect(() => {
    armNotificationHandler();
  }, []);
  useEffect(() => {
    if (!uid) return;
    void registerPushToken(uid);
    const stop = watchLastSeen(uid);
    let sub: { remove: () => void } | undefined;
      void import("expo-notifications")
      .then((N) => {
        const handle = (res: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => {
          const data = res.notification.request.content.data || {};
          const kind = String(data.kind || "");
          if (kind === "founder_desk") {
            void revealFounderDesk().then(() => {
              const next = getFounderDeskJob();
              if (next && next.phase !== "reviewing") router.push(founderDeskRoute(next));
            });
            return;
          }
          if (kind === "friend_request" || kind === "friend_accepted") {
            router.push("/inbox");
            return;
          }
          if (kind === "friend_message" && typeof data.conversationId === "string") {
            router.push({ pathname: "/friends/chat/[id]", params: { id: data.conversationId } });
            return;
          }
          if (kind === "today" || kind === "first_find") {
            router.push("/");
            return;
          }
          if (kind === "cart") {
            router.push("/cart");
            return;
          }
          if (kind === "wallet") {
            router.push("/wallet");
            return;
          }
          if ((kind === "sold" || kind === "shipped" || kind === "delivered" || kind === "order") && typeof data.orderId === "string" && data.orderId) {
            router.push({ pathname: "/order/[id]", params: { id: data.orderId } });
            return;
          }
          const pieceId = data.pieceId;
          const alertId = data.alertId;
          const threadId = data.threadId;
          if (typeof pieceId === "string" && pieceId) {
            if (typeof alertId === "string" && alertId) {
              router.push({ pathname: "/closet/[id]", params: { id: pieceId } });
              return;
            }
            if (kind === "like") {
              router.push({ pathname: "/closet/[id]", params: { id: pieceId } });
              return;
            }
            router.push({
              pathname: "/ask/[id]",
              params: { id: pieceId, ...(typeof threadId === "string" && threadId ? { threadId } : {}) },
            });
          }
        };
        sub = N.addNotificationResponseReceivedListener(handle);
        void N.getLastNotificationResponseAsync().then((res) => { if (res) handle(res as never); }).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      stop();
      sub?.remove();
    };
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    void syncEngagement({
      allowed: app.wantsUpdates,
      hasBag: cart.count > 0,
      hasFirstFind: find.remaining > 10,
    });
  }, [uid, app.wantsUpdates, cart.count, find.remaining]);
  return null;
}

function AppStack() {
  const appearance = useResolvedAppearance();
  const colors = useColors();
  const C = useCopy();
  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      dark: appearance === "dark",
      colors: {
        ...DarkTheme.colors,
        background: colors.ink,
        card: colors.ink,
        text: colors.bone,
        border: colors.ink,
        primary: colors.bone,
        notification: colors.pulse,
      },
    }),
    [appearance, colors],
  );
  return (
    <ThemeProvider value={navTheme}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
        <PushSync />
        <AlertSync />
        <OrderSync />
        <LikesSync />
        <ShakeToReport />
        <StatusBar style={appearance === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerTintColor: colors.bone,
            contentStyle: { backgroundColor: colors.ink },
            headerStyle: { backgroundColor: colors.ink },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerBackTitle: "",
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Closet", animation: "none" }} />
          <Stack.Screen name="mirror-camera" options={{ headerShown: false, animation: "slide_from_bottom", contentStyle: { backgroundColor: "#0B0A08" } }} />
          <Stack.Screen name="visual-search" options={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: "#0B0A08" } }} />
          <Stack.Screen name="onboard" options={{ headerShown: false, animation: "none" }} />
          <Stack.Screen
            name="product/[id]"
            options={{
              headerTransparent: true,
              headerTitle: "",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="seller-analytics"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="alerts"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="legal/[id]"
            options={{
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              headerTitle: C.settings,
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              headerTitle: "About Uvel",
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="guide"
            options={{
              headerTitle: "How to use Uvel",
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="appearance"
            options={{
              headerTitle: C.appearance,
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="personalization"
            options={{
              headerTitle: "Today personalization",
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="language"
            options={{
              headerTitle: C.language,
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="price"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="sell"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="style-dna"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="sell-category"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="sell-condition"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="sell-countries"
            options={{
              headerShown: false,
              title: "",
              headerBackTitle: "",
              headerStyle: { backgroundColor: colors.ink },
              headerTintColor: colors.bone,
              headerShadowVisible: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="closet/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="try-on"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="scan"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="ask/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="friends/chat/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="inbox"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="store"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="checkout/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="wallet"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="invite"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="cart"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="address"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="order/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/apply"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/hq"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/studio"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/founder"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/founder/[stage]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/decision"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/list"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/analytics"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
          <Stack.Screen
            name="brand/invite"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
            }}
          />
        </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

function DraftResumeNotice() {
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof consumeListingDraftNotice>>>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void consumeListingDraftNotice().then((saved) => {
      if (!active || !saved) return;
      setDraft(saved);
      setVisible(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!visible || !draft) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 58, left: 16, right: 16, zIndex: 100 }}>
      <View style={{ backgroundColor: "#1A1915", borderColor: "#D6E27A", borderWidth: 1, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <Text style={{ color: "#D6E27A", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>DRAFT SAVED</Text>
        <Text style={{ color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 6 }}>Your listing draft was saved.</Text>
        <Text style={{ color: "rgba(244,240,230,0.62)", fontSize: 13, lineHeight: 19, marginTop: 4 }}>Continue where you left off in your listing.</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => setVisible(false)} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(244,240,230,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#F4F0E6", fontWeight: "700", fontSize: 13 }}>Later</Text>
          </Pressable>
          <Pressable onPress={() => { setVisible(false); router.push({ pathname: "/sell", params: { draft: "1" } }); }} style={{ flex: 1.2, height: 42, borderRadius: 21, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#16140F", fontWeight: "800", fontSize: 13 }}>Continue draft</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function Root() {
  const { onboarded, hydrated, uid, profileDone, profileChecked } = useUvel();
  const appearance = useResolvedAppearance();
  const colors = useColors();
  useOtaReady();
  const [intro, setIntro] = useState(true);
  const dismiss = useCallback(() => setIntro(false), []);
  const gateReady = hydrated && profileChecked;
  const needProfile = Boolean(uid) && profileChecked && !profileDone;
  const signedIn = Boolean(uid);

  useEffect(() => {
    if (!hydrated) return;
    void pullLooks();
    void armFounderDesk();
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: intro ? colors.pulse : colors.ink }}>
        <StatusBar style={appearance === "dark" ? "light" : "dark"} />
        {gateReady ? (
          !onboarded && !signedIn ? (
            <Onboard />
          ) : needProfile ? (
            <ProfileSetup />
          ) : (
            <AppStack />
          )
        ) : null}
        {signedIn && gateReady && !intro ? <DraftResumeNotice /> : null}
        {signedIn && gateReady && !intro ? <FounderDeskNotice /> : null}
        {intro || !gateReady ? <LaunchSplash ready={gateReady} onDone={dismiss} /> : null}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
