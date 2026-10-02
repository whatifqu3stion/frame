import type { ViewStyle } from "react-native";

/** Native logical units. Width caps include the page's own horizontal gutters. */
export const contentWidths = { reading: 640, collection: 720 } as const;
export const expandedNavigationWidth = 1000;
export const boundedCollection: ViewStyle = { width: "100%", maxWidth: contentWidths.collection, alignSelf: "center" };
export const boundedReading: ViewStyle = { width: "100%", maxWidth: contentWidths.reading, alignSelf: "center" };
