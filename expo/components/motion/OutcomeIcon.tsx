import { useIsFocused } from "@react-navigation/native";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator } from "react-native";
import MotionView from "@/components/motion/MotionView";
import { motion } from "@/constants/motion";

/** Stay mounted through loading so only a newly confirmed outcome settles in. */
export default function OutcomeIcon({ confirmed, busy = false, color, size = 18, idle, children }: {
  confirmed: boolean; busy?: boolean; color: string; size?: number; idle: ReactNode; children: ReactNode;
}) {
  const focused = useIsFocused();
  const settled = useRef(confirmed);
  const outcome = busy ? settled.current : confirmed;
  useEffect(() => { if (!busy) settled.current = confirmed; }, [busy, confirmed]);
  const complete = confirmed && !busy;
  return <MotionView changeKey={outcome} active={focused && complete} fromScale={0.86} duration={motion.confirm}
    accessible={false} pointerEvents="none" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    {busy ? <ActivityIndicator size="small" color={color} /> : confirmed ? children : idle}
  </MotionView>;
}
