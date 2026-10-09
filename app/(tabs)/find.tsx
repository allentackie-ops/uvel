import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Share as NativeShare } from "react-native";
import { FriendShareSheet, type FriendSharePayload } from "../../components/FriendShareSheet";
import { MirrorStudioView } from "../../components/MirrorStudioView";
import { addToCart, inCart } from "../../lib/cart";
import { pickFromLibrary, pickListingPhoto } from "../../lib/photo";
import { enqueueMirrorJob, getActiveMirrorJobId, saveMirrorRating, setActiveMirrorJobId, watchMirrorJob, type MirrorJobSource, type MirrorJobStatus } from "../../lib/mirrorJobs";
import { persistMirrorPhoto } from "../../lib/mirrorPhoto";
import { useUvel } from "../../lib/store";
import { getPiece, refreshMarketplaceListings, shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { onMirrorPick } from "../../lib/mirrorPick";

type GarmentPick =
  | { kind: "uvel"; piece: ClosetPiece }
  | { kind: "photo" | "link"; uri: string; name: string };

type MirrorProps = { standalone?: boolean; initialJobId?: string; initialPieceId?: string };

export default function Mirror({ standalone = false, initialJobId, initialPieceId }: MirrorProps = {}) {
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
  const [jobId, setJobId] = useState<string | null>(initialJobId || null);
  const [jobStatus, setJobStatus] = useState<MirrorJobStatus | null>(initialJobId ? "queued" : null);
  const [jobSource, setJobSource] = useState<MirrorJobSource | null>(null);
  const [jobPieceId, setJobPieceId] = useState("");
  const [jobGarmentName, setJobGarmentName] = useState("");
  const initialPieceApplied = useRef(false);

  const garmentUri = picked?.kind === "uvel" ? picked.piece.photo : picked?.uri;
  const selectedGarmentName = picked?.kind === "uvel" ? picked.piece.name : picked?.name;
  const garmentName = selectedGarmentName || jobGarmentName || "this look";
  const garmentCat = picked?.kind === "uvel" ? picked.piece.category : "clothes";

  useEffect(() => {
    if (initialPieceApplied.current || !initialPieceId) return;
    const piece = getPiece(initialPieceId);
    if (!piece) return;
    initialPieceApplied.current = true;
    setPicked({ kind: "uvel", piece });
    setResult(null);
    setJobStatus(null);
    setJobSource(null);
    setJobPieceId("");
    setJobGarmentName("");
    setErr("");
    setJobId(null);
    if (app.uid) void setActiveMirrorJobId(app.uid, null);
  }, [app.uid, initialPieceId, live]);

  useEffect(() => {
    if (!app.hydrated || !app.uid || initialJobId) return;
    let active = true;
    void getActiveMirrorJobId(app.uid).then((savedId) => {
      if (active && savedId) {
        setJobStatus("queued");
        setJobId((current) => current || savedId);
      }
    });
    return () => { active = false; };
  }, [app.hydrated, app.uid, initialJobId]);

  useEffect(() => {
    if (!initialJobId) return;
    setJobStatus("queued");
    setJobId(initialJobId);
    if (app.uid) {
      void getActiveMirrorJobId(app.uid).then((savedId) => {
        if (!savedId) void setActiveMirrorJobId(app.uid, initialJobId);
      });
    }
  }, [app.uid, initialJobId]);

  useEffect(() => {
    if (!app.uid || !jobId) return;
    return watchMirrorJob(app.uid, jobId, (job) => {
      if (!job) {
        setJobStatus("failed");
        setBusy(false);
        setErr("This Mirror look is no longer available. Start another one whenever you’re ready.");
        return;
      }
      setJobStatus(job.status);
      setJobSource(job.sourceKind);
      setJobPieceId(job.pieceId || "");
      setJobGarmentName(job.garmentName || "Your look");
      if (job.status === "completed" && job.resultUri) {
        setResult(job.resultUri);
        setBusy(false);
        setErr("");
      } else if (job.status === "failed") {
        setResult(null);
        setBusy(false);
        setErr(job.errorMessage || "We couldn’t finish this look. Please try another photo or piece.");
      }
    }, () => {
      setErr("We couldn’t reconnect to your Mirror look. Check your connection and try again.");
    });
  }, [app.uid, jobId]);

  useEffect(() => {
    return onMirrorPick((id) => {
      const piece = getPiece(id);
      if (!piece) return;
      setPicked({ kind: "uvel", piece });
      setResult(null);
      setJobStatus(null);
      setJobSource(null);
      setJobPieceId("");
      setJobGarmentName("");
      setErr("");
      setJobId(null);
      if (app.uid) void setActiveMirrorJobId(app.uid, null);
    });
  }, [app.uid]);

  function clearOutput(clearPicked = false) {
    setResult(null);
    setBusy(false);
    setJobStatus(null);
    setJobSource(null);
    setJobPieceId("");
    setJobGarmentName("");
    setErr("");
    setJobId(null);
    if (app.uid) void setActiveMirrorJobId(app.uid, null);
    if (clearPicked) setPicked(null);
  }

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
        const durableUri = await persistMirrorPhoto(uri);
        await app.setPerson(durableUri);
        clearOutput();
      }
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Couldn’t open photos.");
    }
  }

  async function pickGarmentFromPhotos() {
    try {
      // The native crop editor lets the user frame the garment before it enters Mirror.
      const uri = await pickListingPhoto();
      if (!uri) return;
      setPicked({ kind: "photo", uri, name: "Selected clothing" });
      clearOutput();
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
      setPicked({ kind: "link", uri: imageUrl, name: "Pasted item" });
      setShowLink(false);
      clearOutput();
    } catch {
      setErr("Couldn’t find a product photo at that link. Try a direct image or a product page with a public item photo.");
    } finally {
      setLinkBusy(false);
    }
  }

  function clearGarment() {
    setPicked(null);
    clearOutput();
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
    if (!person || !garmentUri || busy || jobStatus === "queued" || jobStatus === "processing") return;
    setErr("");
    setBusy(true);
    try {
      const durablePerson = await persistMirrorPhoto(person);
      if (durablePerson !== person) await app.setPerson(durablePerson);
      const sourceKind: MirrorJobSource = picked?.kind === "uvel" ? "uvel" : picked?.kind === "link" ? "link" : "photo";
      const pieceId = picked?.kind === "uvel" ? picked.piece.id : "";
      const createdJobId = await enqueueMirrorJob({
        personUri: durablePerson,
        garmentUri,
        sourceKind,
        garmentName,
        pieceId,
      });
      setJobId(createdJobId);
      setJobStatus("queued");
      setJobSource(sourceKind);
      setJobPieceId(pieceId);
      setJobGarmentName(garmentName);
      setResult(null);
      app.consumeTryOn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t start that Mirror look. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function tryAnother() {
    clearOutput(true);
  }

  const mirrorShare: FriendSharePayload | null = result
    ? { kind: "mirror", title: `${garmentName} on me`, deepLink: `uvel://mirror${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`, imageUri: result, previewText: `I tried ${garmentName} in Mirror on Uvel.` }
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
        jobStatus={jobStatus}
        sourceKind={jobSource || (picked?.kind === "uvel" ? "uvel" : picked?.kind === "link" ? "link" : picked ? "photo" : null)}
        pieceId={jobPieceId || (picked?.kind === "uvel" ? picked.piece.id : "")}
        pieces={live}
        marketplaceUnavailable={marketplaceSync === "unavailable"}
        retryingMarketplace={retryingMarketplace}
        link={link}
        linkBusy={linkBusy}
        showLink={showLink}
        onBack={() => router.back()}
        onAddPerson={askPerson}
        onChangePerson={askPerson}
        onPickPiece={(piece) => {
          setPicked({ kind: "uvel", piece });
          clearOutput();
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
        onTryAnother={tryAnother}
        onRate={(value) => { if (app.uid && jobId) void saveMirrorRating(app.uid, jobId, value); }}
        onAddToCart={() => {
          const id = jobPieceId || (picked?.kind === "uvel" ? picked.piece.id : "");
          if (!id) return false;
          const alreadyInCart = inCart(id);
          if (!alreadyInCart) addToCart(id);
          return !alreadyInCart;
        }}
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
