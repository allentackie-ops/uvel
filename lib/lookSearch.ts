export type LookScan = {
  frame: string;
  title: string;
  videoUrl: string;
  imageUrl: string;
  time: number;
  done: boolean;
};

let scan: LookScan = { frame: "", title: "", videoUrl: "", imageUrl: "", time: 0, done: false };
const listeners = new Set<(s: LookScan) => void>();

function emit() {
  listeners.forEach((l) => l(scan));
}

export function beginLookScan(input: { title?: string; videoUrl?: string; imageUrl?: string; time?: number }) {
  scan = {
    frame: "",
    title: input.title || "",
    videoUrl: input.videoUrl || "",
    imageUrl: input.imageUrl || "",
    time: input.time || 0,
    done: false,
  };
  emit();
}

export function finishLookScan(frame: string) {
  if (!frame) return;
  scan = { ...scan, frame, done: true };
  emit();
}

export function setLookScan(frame: string, title = "") {
  scan = { ...scan, frame, title: title || scan.title, done: true };
  emit();
}

export function takeLookScan() {
  return scan;
}

export function watchLookScan(cb: (s: LookScan) => void) {
  listeners.add(cb);
  cb(scan);
  return () => {
    listeners.delete(cb);
  };
}

export function clearLookScan() {
  scan = { frame: "", title: "", videoUrl: "", imageUrl: "", time: 0, done: false };
  emit();
}
