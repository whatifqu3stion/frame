import { Redirect } from "expo-router";

/** Compatibility route for links created before Saved replaced Library. */
export default function LibraryCompatibilityRoute() {
  return <Redirect href="/(tabs)/saved" />;
}
