import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { firebaseApp, firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type MirrorJobStatus = "queued" | "processing" | "completed" | "failed";
export type MirrorJobSource = "uvel" | "photo" | "link";

export type MirrorJobSnapshot = {
  id: string;
  status: MirrorJobStatus;
  sourceKind: MirrorJobSource;
  garmentName: string;
  pieceId?: string;
  resultPath?: string;
  resultUri?: string;
  errorMessage?: string;
};

const ACTIVE_JOB_KEY = "uvel-mirror-active-job-v1:";
const INPUT_LIMIT_BYTES = 8 * 1024 * 1024;

function newJobId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

async function compressJpeg(uri: string, width: number) {
  let compressedUri = uri;
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.84, format: SaveFormat.JPEG });
    compressedUri = saved.uri;
  } catch {
    // A direct image URL may not be supported by the native manipulator; fetch it as-is below.
  }
  const response = await fetch(compressedUri);
  if (!response.ok) throw new Error("Couldn’t read one of those photos. Choose it again.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("One of those photos is empty. Choose it again.");
  if (blob.size > INPUT_LIMIT_BYTES) throw new Error("Choose images smaller than 8 MB.");
  return blob;
}

export async function enqueueMirrorJob(input: {
  personUri: string;
  garmentUri: string;
  sourceKind: MirrorJobSource;
  garmentName: string;
  pieceId?: string;
}) {
  const user = firebaseAuth().currentUser;
  if (!firebaseReady() || !user?.uid) throw new Error("Sign in to create a Mirror look and receive its notification.");
  const uid = user.uid;
  const jobId = newJobId();
  const basePath = `users/${uid}/mirror-jobs/${jobId}`;
  const personRef = ref(getStorage(firebaseApp()), `${basePath}/person.jpg`);
  const garmentRef = ref(getStorage(firebaseApp()), `${basePath}/garment.jpg`);
  try {
    const [person, garment] = await Promise.all([
      compressJpeg(input.personUri, 1200),
      compressJpeg(input.garmentUri, 1000),
    ]);
    await Promise.all([
      uploadBytes(personRef, person, { contentType: "image/jpeg", cacheControl: "private, max-age=0" }),
      uploadBytes(garmentRef, garment, { contentType: "image/jpeg", cacheControl: "private, max-age=0" }),
    ]);
    const start = httpsCallable(firebaseFunctions(), "startMirrorJob");
    await start({
      jobId,
      sourceKind: input.sourceKind,
      garmentName: input.garmentName,
      pieceId: input.pieceId || "",
    });
    await AsyncStorage.setItem(`${ACTIVE_JOB_KEY}${uid}`, jobId);
    return jobId;
  } catch (error) {
    await httpsCallable(firebaseFunctions(), "cleanupMirrorInputs")({ jobId }).catch(() => undefined);
    const code = String((error as { code?: string })?.code || "").toLowerCase();
    const message = error instanceof Error ? error.message : "Couldn’t start that Mirror look.";
    if (code.includes("resource-exhausted") || /reached today.s mirror limit/i.test(message)) {
      throw new Error(/already being created/i.test(message) ? message : "You’ve reached today’s Mirror limit (3 looks). Try again tomorrow.");
    }
    if (code.includes("unauthenticated")) throw new Error("Sign in to create a Mirror look and receive its notification.");
    throw new Error(message || "Couldn’t start that Mirror look. Check your connection and try again.");
  }
}

export async function getActiveMirrorJobId(uid: string) {
  if (!uid) return null;
  return AsyncStorage.getItem(`${ACTIVE_JOB_KEY}${uid}`).catch(() => null);
}

export async function setActiveMirrorJobId(uid: string, jobId: string | null) {
  if (!uid) return;
  const key = `${ACTIVE_JOB_KEY}${uid}`;
  if (jobId) await AsyncStorage.setItem(key, jobId).catch(() => undefined);
  else await AsyncStorage.removeItem(key).catch(() => undefined);
}

export function watchMirrorJob(uid: string, jobId: string, onChange: (job: MirrorJobSnapshot | null) => void, onError?: () => void) {
  const jobRef = doc(firebaseDb(), "users", uid, "mirrorJobs", jobId);
  let active = true;
  const unsubscribe = onSnapshot(jobRef, (snapshot) => {
    if (!active) return;
    if (!snapshot.exists()) {
      if (!snapshot.metadata.fromCache) onChange(null);
      return;
    }
    const data = snapshot.data();
    const status = String(data.status || "queued") as MirrorJobStatus;
    const resultPath = typeof data.resultPath === "string" ? data.resultPath : "";
    const storedResultUrl = typeof data.resultUrl === "string" ? data.resultUrl : "";
    const emit = (resultUri?: string) => {
      if (!active) return;
      onChange({
        id: snapshot.id,
        status,
        sourceKind: (data.sourceKind === "uvel" || data.sourceKind === "link" ? data.sourceKind : "photo") as MirrorJobSource,
        garmentName: String(data.garmentName || "Your look"),
        ...(typeof data.pieceId === "string" && data.pieceId ? { pieceId: data.pieceId } : {}),
        ...(resultPath ? { resultPath } : {}),
        ...(resultUri ? { resultUri } : {}),
        ...(typeof data.errorMessage === "string" && data.errorMessage ? { errorMessage: data.errorMessage } : {}),
      });
    };
    if (status === "completed" && storedResultUrl) {
      emit(storedResultUrl);
    } else if (status === "completed" && resultPath) {
      void getDownloadURL(ref(getStorage(firebaseApp()), resultPath)).then(emit).catch(() => emit());
    } else {
      emit();
    }
  }, () => {
    if (active) onError?.();
  });
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function saveMirrorRating(uid: string, jobId: string, rating: number) {
  if (!uid || !jobId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !firebaseReady()) return;
  await setDoc(doc(firebaseDb(), "users", uid, "mirrorFeedback", jobId), {
    rating,
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch(() => undefined);
}
