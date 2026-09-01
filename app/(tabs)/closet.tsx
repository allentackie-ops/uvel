import Sell from "../sell";
import { TabSwipeNavigator } from "../../components/TabSwipeNavigator";

export default function Closet() {
  return (
    <TabSwipeNavigator index={2}>
      <Sell embedded />
    </TabSwipeNavigator>
  );
}
