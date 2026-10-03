import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Share as NativeShare } from "react-native";
import { FriendShareSheet, type FriendSharePayload } from "../../components/FriendShareSheet";
import { MirrorStudioView } from "../../components/MirrorStudioView";
import { pickFromLibrary, pickListingPhoto } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { dressPerson } from "../../lib/tryon";
import { getPiece, refreshMarketplaceListings, shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { onMirrorPick } from "../../lib/mirrorPick";

type GarmentPick =
  | { kind: "uvel"; piece: ClosetPiece }
  | { kind: "photo"; uri: string; name: string };

export default function Mirror({ standalone = false }: { standalone?: boolean } = {}) {
  const app = useUvel();
  useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  const live = shopFloor(app.country);
  const person = app.personUri;
  const [picked, setPicked] = useState<GarmentPick | null>(null);
  const [link, setLink] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [retryingMarketplace, setRetryingMarketplace] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    return onMirrorPick((id) => {
      const piece = getPiece(id);
      if (!piece) return;
      setPicked({ kind: "uvel", piece });
      setResult(null);
      setErr("");
    });
  }, []);

  const garmentUri = picked?.kind === "uvel" ? picked.piece.photo : picked?.uri;
  const garmentName = picked?.kind === "uvel" ? picked.piece.name : picked?.name ?? "this look";
  const garmentCat = picked?.kind === "uvel" ? picked.piece.category : "clothes";

  function askPerson() {
    const options = ["Camera", "Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: "Full-length photo of you" },
        (index) => {
          if (index === 0) void fromCamera();
          if (index === 1) void fromLibrary();
        },
      );
      return;
    }
    Alert.alert("Full-length photo of you", "Use a clear Mirror pic from head to shoes.", [
      { text: "Camera", onPress: () => void fromCamera() },
      { text: "Library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function fromCamera() {
    router.push("/mirror-camera");
  }

  async function fromLibrary() {
    try {
      const uri = await pickFromLibrary();
      if (uri) {
        app.setPerson(uri);
        setResult(null);
        setErr("");
      }
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Couldn’t open photos.");
    }
  }

  async function pickGarmentFromPhotos() {
    try {
      // Expo's native crop editor lets the user frame the garment before it enters Mirror.
      const uri = await pickListingPhoto();
      if (!uri) return;
      setPicked({ kind: "photo", uri, name: "Selected clothing" });
      setResult(null);
      setErr("");
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Couldn’t open that photo.");
    }
  }

  async function useLink() {
    const raw = link.trim();
    if (!raw) {
      setErr("Paste an item link first.");
      return;
    }

    let itemUrl: URL;
    try {
      itemUrl = new URL(raw);
      if (!/^https?:$/.test(itemUrl.protocol)) throw new Error("unsupported");
    } catch {
      setErr("Paste a valid http or https item link.");
      return;
    }

    setLinkBusy(true);
    setErr("");
    try {
      const response = await fetch(itemUrl.toString(), {
        headers: { Accept: "text/html,image/*,*/*;q=0.8" },
      });
      if (!response.ok) throw new Error("unavailable");
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      let imageUrl = itemUrl.toString();
      if (!contentType.startsWith("image/")) {
        const html = await response.text();
        const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i);
        if (!match?.[1]) throw new Error("no-image");
        imageUrl = new URL(match[1].replace(/&amp;/g, "&"), itemUrl).toString();
      }
      setPicked({ kind: "photo", uri: imageUrl, name: "Pasted item" });
      setShowLink(false);
      setResult(null);
      setErr("");
    } catch {
      setErr("Couldn’t find a product photo at that link. Try a direct image or a product page with a public item photo.");
    } finally {
      setLinkBusy(false);
    }
  }

  function clearPerson() {
    app.setPerson(null);
    setResult(null);
    setErr("");
  }

  function clearGarment() {
    setPicked(null);
    setResult(null);
    setErr("");
  }

  async function retryMarketplace() {
    if (retryingMarketplace) return;
    setRetryingMarketplace(true);
    try {
      await refreshMarketplaceListings();
    } finally {
      setRetryingMarketplace(false);
    }
  }

  async function run() {
    if (!person || !garmentUri) return;
    setErr("");
    setBusy(true);
    try {
      const dressed = await dressPerson({
        personUri: person,
        garment: { uri: garmentUri },
        garmentName,
        category: garmentCat,
      });
      app.consumeTryOn();
      setResult(dressed);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setErr(
        /timeout|timed out|unexpectedexception|fetch failed|expo modules/i.test(raw)
          ? "That look took too long. Try again."
          : raw || "Couldn’t dress you in that.",
      );
    } finally {
      setBusy(false);
    }
  }

  const mirrorShare: FriendSharePayload | null = result
    ? { kind: "mirror", title: `${garmentName} on me`, deepLink: "uvel://mirror", imageUri: result, previewText: `I tried ${garmentName} in Mirror on Uvel.` }
    : null;

  return (
    <>
      <MirrorStudioView
        standalone={standalone}
        personUri={person}
        resultUri={result}
        garmentUri={garmentUri || null}
        garmentName={garmentName}
        error={err}
        busy={busy}
        pieces={live}
        marketplaceUnavailable={marketplaceSync === "unavailable"}
        retryingMarketplace={retryingMarketplace}
        link={link}
        linkBusy={linkBusy}
        showLink={showLink}
        onBack={() => router.back()}
        onAddPerson={askPerson}
        onChangePerson={askPerson}
        onRemovePerson={clearPerson}
        onPickPiece={(piece) => {
          setPicked({ kind: "uvel", piece });
          setResult(null);
          setErr("");
        }}
        onPickPhoto={() => void pickGarmentFromPhotos()}
        onClearGarment={clearGarment}
        onChangeLink={setLink}
        onOpenLink={() => {
          setErr("");
          setShowLink(true);
        }}
        onCloseLink={() => setShowLink(false)}
        onUseLink={() => void useLink()}
        onTryOn={() => void run()}
        onShare={() => setShareOpen(true)}
        onRetryMarketplace={() => void retryMarketplace()}
      />
      <FriendShareSheet
        visible={shareOpen}
        payload={mirrorShare}
        onClose={() => setShareOpen(false)}
        onExternalShare={() => {
          setShareOpen(false);
          void NativeShare.share({
            title: mirrorShare?.title || "Mirror fit",
            message: `${mirrorShare?.previewText || "Check out my Mirror fit on Uvel."}`,
          });
        }}
      />
    </>
  );
}
