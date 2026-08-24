import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColors } from "../../lib/theme";

export default function TabsLayout() {
  const colors = useColors();

  return (
    <NativeTabs tintColor={colors.bone} blurEffect="systemChromeMaterialDark" shadowColor="transparent">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets contentStyle={{ backgroundColor: "#0B0A08" }}>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="safari" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find">
        <NativeTabs.Trigger.Label>Mirror</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.stand" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="closet">
        <NativeTabs.Trigger.Label>Sell</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Label>Shop</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
