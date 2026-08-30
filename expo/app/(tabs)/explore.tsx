import { Redirect } from "expo-router";

/** Compatibility route for links created before Sources replaced Explore. */
export default function ExploreCompatibilityRoute() {
  return <Redirect href="/(tabs)/sources" />;
}
