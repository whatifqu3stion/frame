import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useFrameTheme } from "@/constants/useFrameTheme";

export const printStudies = ["orbit", "fold", "arc"] as const;
export type PrintMotif = typeof printStudies[number];

export default function PrintStudy({ motif }: { motif: PrintMotif }) {
  const { palette } = useFrameTheme();
  return <Svg width="100%" height="100%" viewBox="0 0 116 104" preserveAspectRatio="xMidYMid slice">
    <Rect width={116} height={104} fill={motif === "orbit" ? palette.programme : motif === "fold" ? palette.accentSoft : palette.clay} />
    {motif === "orbit" ? <>
      <Circle cx={29} cy={98} r={84} fill="none" stroke={palette.onProgrammeSoft} strokeWidth={1} />
      <Circle cx={29} cy={98} r={60} fill="none" stroke={palette.onProgrammeSoft} strokeWidth={1} />
      <Circle cx={73} cy={24} r={15} fill={palette.clay} />
    </> : motif === "fold" ? <>
      <Path d="M-2 92L84 0H116L20 104H-2Z" fill={palette.sage} />
      <Path d="M20 104L116 0V46L62 104Z" fill={palette.accentDeep} />
    </> : <>
      <Circle cx={115} cy={107} r={96} fill={palette.programme} />
      <Circle cx={115} cy={107} r={74} fill={palette.rose} />
      <Circle cx={115} cy={107} r={52} fill={palette.programme} />
    </>}
  </Svg>;
}
