import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type SortablePhoto = { uri: string; status: string };

type Props = {
  photos: SortablePhoto[];
  onPreview: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  renderPhoto: (photo: SortablePhoto, index: number) => ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const REORDER_STEP = 72;

export function SortablePhotoStrip({ photos, onPreview, onReorder, renderPhoto, contentContainerStyle }: Props) {
  return (
    <View style={contentContainerStyle}>
      {photos.map((photo, index) => (
        <SortablePhotoTile
          key={photo.uri}
          index={index}
          count={photos.length}
          onPreview={onPreview}
          onReorder={onReorder}
        >
          {renderPhoto(photo, index)}
        </SortablePhotoTile>
      ))}
    </View>
  );
}

function SortablePhotoTile({
  index,
  count,
  onPreview,
  onReorder,
  children,
}: {
  index: number;
  count: number;
  onPreview: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const dragIndex = useSharedValue(-1);
  const startIndex = useSharedValue(index);

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(onPreview)(index);
    });

  const drag = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart(() => {
      startIndex.value = index;
      dragIndex.value = index;
    })
    .onUpdate((event) => {
      if (dragIndex.value < 0 || Math.abs(event.translationX) < 24) return;
      const next = Math.max(0, Math.min(count - 1, startIndex.value + Math.round(event.translationX / REORDER_STEP)));
      if (next === dragIndex.value) return;
      runOnJS(onReorder)(dragIndex.value, next);
      dragIndex.value = next;
    })
    .onEnd(() => {
      dragIndex.value = -1;
    });

  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <View>{children}</View>
    </GestureDetector>
  );
}
