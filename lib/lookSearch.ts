let pendingFrame = "";
let pendingTitle = "";

export function setLookScan(frame: string, title = "") {
  pendingFrame = frame;
  pendingTitle = title;
}

export function takeLookScan() {
  return { frame: pendingFrame, title: pendingTitle };
}

export function clearLookScan() {
  pendingFrame = "";
  pendingTitle = "";
}
