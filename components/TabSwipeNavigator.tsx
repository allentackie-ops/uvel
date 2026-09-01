import { useMemo, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { router } from "expo-router";

const TABS = ["/(tabs)/index", "/(tabs)/find", "/(tabs)/closet", "/(tabs)/shop", "/(tabs)/you"] as const;

type TabSwipeNavigatorProps = PropsWithChildren<{ index: number }>;

export function TabSwipeNavigator({ children, index }: TabSwipeNavigatorProps) {
  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= TABS.length || nextIndex === index) return;
    router.navigate(TABS[nextIndex]);
  };

  const gestures = useMemo(() => {
    const previous = Gesture.Pan()
      .activeOffsetX([36, 9999])
      .failOffsetY([-28, 28])
      .maxPointers(1)
      .onEnd((event) => {
        if (event.translationX > 56 && event.velocityX > 0) runOnJS(goTo)(index - 1);
      });
    const next = Gesture.Pan()
      .activeOffsetX([-9999, -36])
      .failOffsetY([-28, 28])
      .maxPointers(1)
      .onEnd((event) => {
        if (event.translationX < -56 && event.velocityX < 0) runOnJS(goTo)(index + 1);
      });
    return { previous, next };
  }, [index]);

  return (
    <View style={styles.root}>
      {children}
      {index > 0 ? (
        <GestureDetector gesture={gestures.previous}>
          <View style={[styles.edge, styles.leftEdge]} accessible={false} />
        </GestureDetector>
      ) : null}
      {index < TABS.length - 1 ? (
        <GestureDetector gesture={gestures.next}>
          <View style={[styles.edge, styles.rightEdge]} accessible={false} />
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  edge: { position: "absolute", top: 0, bottom: 0, width: 30, zIndex: 100 },
  leftEdge: { left: 0 },
  rightEdge: { right: 0 },
});
