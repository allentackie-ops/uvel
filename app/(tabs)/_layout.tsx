import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColors } from "../../lib/theme";
import { useCopy } from "../../lib/useCopy";

export default function TabsLayout() {
  const colors = useColors();
  const C = useCopy();

  return (
    <NativeTabs tintColor={colors.bone} blurEffect="systemChromeMaterialDark" shadowColor="transparent">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets contentStyle={{ backgroundColor: "#0B0A08" }}>
        <NativeTabs.Trigger.Label>{C.today}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="safari" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find">
        <NativeTabs.Trigger.Label>{C.mirror}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.stand" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="closet">
        <NativeTabs.Trigger.Label>{C.sell}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Label>{C.shop}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Label>{C.you}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
