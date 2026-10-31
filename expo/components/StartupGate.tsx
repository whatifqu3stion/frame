import type { ReactNode } from "react";
import { useApp } from "@/providers/AppProvider";
import RecoveryScreen from "@/components/RecoveryScreen";

export default function StartupGate({ children }: { children: ReactNode }) {
  const { ready, startupError, retryStartup } = useApp();
  if (!ready) return <RecoveryScreen loading={!startupError}
    title={startupError ? "Frame couldn’t open your library" : "Opening Frame…"}
    message={startupError ? "Your profile couldn’t be restored. Try again. If this continues, close and reopen Frame." : undefined}
    onRetry={startupError ? retryStartup : undefined} />;
  return <>{children}</>;
}
