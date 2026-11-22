import { createContext, forwardRef, useContext, type PropsWithChildren } from "react";
import { Platform, Text as NativeText, useWindowDimensions, type TextProps } from "react-native";

const FontScaleContext = createContext(1);

/** A single subscription keeps native text layout in sync with live Dynamic Type changes. */
export function FontScaleProvider({ children }: PropsWithChildren) {
  const { fontScale } = useWindowDimensions();
  return <FontScaleContext.Provider value={fontScale}>{children}</FontScaleContext.Provider>;
}

/** Refresh only text hosts when iOS font metrics change; preserve screens, forms and navigation. */
export type FrameTextRef = NativeText;
const FrameText = forwardRef<NativeText, TextProps>(function FrameText(props, ref) {
  const fontScale = useContext(FontScaleContext);
  return <NativeText key={Platform.OS === "ios" ? fontScale : "text"} {...props} ref={ref} />;
});
export default FrameText;
