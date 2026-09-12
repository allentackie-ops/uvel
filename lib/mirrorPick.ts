type Listener = (id: string) => void;

let listener: Listener | null = null;

export function onMirrorPick(cb: Listener) {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

export function pickForMirror(id: string) {
  listener?.(id);
}
