import { Redirect } from "expo-router";
import { AccountDetailsScreen } from "../components/AccountDetailsScreen";
import { useUvel } from "../lib/store";

export default function ProfileSetupRoute() {
  const app = useUvel();
  if (app.profileDone) return <Redirect href="/" />;
  return <AccountDetailsScreen />;
}
