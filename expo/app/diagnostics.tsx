import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import Heading from "@/components/Heading";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useMemo, useState } from "react";
import { Platform, Share, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_ENV,
  isGooglePlatformConfigured,
} from "@/constants/config";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { DATABASE_SCHEMA_VERSION, getDatabaseDiagnostics, type DatabaseDiagnostics } from "@/db/database";
import { buildSupportReport } from "@/domain/supportDiagnostics";
import InlineHelp from "@/components/InlineHelp";
import { getThumbnailCleanupStatus } from "@/services/thumbnailRetention";
import type { ThumbnailCleanupStatus } from "@/services/thumbnailCleanup";

const cleanupLabels: Record<ThumbnailCleanupStatus["state"], string> = {
  "not-run": "Not attempted this launch",
  running: "Cleanup in progress",
  succeeded: "Both native APIs reported success",
  pending: "Incomplete; retries on foreground return",
  "web-unmanaged": "Browser-managed cache; native cleanup not available",
};

export default function DiagnosticsRoute() {
  return <DiagnosticsScreen />;
}

function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const databaseQuery = useQuery<DatabaseDiagnostics>({
    queryKey: ["diagnostics", "database"], networkMode: "always",
    queryFn: getDatabaseDiagnostics,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const cleanupQuery = useQuery({
    queryKey: ["diagnostics", "thumbnail-cleanup"],
    queryFn: getThumbnailCleanupStatus,
    refetchInterval: 2_000,
    networkMode: "always",
  });
  const cleanup = cleanupQuery.data;
  const database = databaseQuery.data;
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "unknown";
  const build = Constants.nativeBuildVersion ?? String(Constants.expoConfig?.android?.versionCode ?? "unknown");
  const systemVersion = Platform.OS === "web" ? "browser preview" : String(Platform.Version);
  const report = buildSupportReport({ version, build, platform: Platform.OS, systemVersion, environment: APP_ENV,
    databaseVersion: database?.version ?? null, storage: database?.storage ?? "unavailable",
    cleanup: cleanup?.state ?? "unavailable", googleConfigured: isGooglePlatformConfigured(),
  });

  const shareStatus = async (): Promise<void> => {
    if (sharing) return;
    setSharing(true); setShareError(false);
    try { await Share.share({ title: "Frame diagnostic report", message: report }); }
    catch { setShareError(true); }
    finally { setSharing(false); }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingLeft: insets.left, paddingRight: insets.right, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={type.body}>Include this report when describing a problem. Add what happened and the steps to repeat it.</Text>
        <Text style={type.bodySoft}>No keys, PINs, account details or viewing history are included. Nothing is sent automatically.</Text>
        <InlineHelp label="View diagnostic report"><Text selectable style={type.bodySoft}>{report}</Text></InlineHelp>
        {Platform.OS !== "web" ? <PrimaryAction depth={palette.primaryButtonDepth} disabled={sharing} onPress={() => { void shareStatus(); }} accessibilityRole="button" accessibilityState={{ disabled: sharing, busy: sharing }} style={{ minHeight: 48, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep, alignItems: "center" }}><Text style={[type.label, { color: palette.onDark }]}>{sharing ? "Opening share options…" : "Share diagnostic report"}</Text></PrimaryAction> : <Text style={type.bodySoft}>Sharing is available in the mobile app. You can select and copy the report above.</Text>}
        {shareError ? <Text accessibilityLiveRegion="polite" style={type.bodySoft}>Couldn’t open sharing. Open the report above to select and copy it.</Text> : null}
      </View>

      <View style={{ paddingHorizontal: spacing.page, marginTop: spacing.md }}><InlineHelp label="Technical details">
      <DiagnosticSection title="App and device" styles={styles} type={type}>
        <DiagnosticRow label="App version" value={`${version} · Build ${build}`} styles={styles} type={type} />
        <DiagnosticRow label={Platform.OS === "android" ? "Android API level" : "System"} value={systemVersion} styles={styles} type={type} />
        <DiagnosticRow label="Environment" value={APP_ENV} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Local storage" styles={styles} type={type}>
        <DiagnosticRow
          label="Database version"
          value={database ? `${database.version}${database.version === 0 ? " (unversioned baseline)" : ""}` : databaseQuery.isError ? "unavailable" : `${DATABASE_SCHEMA_VERSION} (loading)`}
          styles={styles}
          type={type}
        />
        <DiagnosticRow label="Storage" value={database?.storage ?? (databaseQuery.isError ? "unavailable" : "loading")} styles={styles} type={type} />
        <DiagnosticRow label="Tables" value={database?.tables.join(", ") ?? (databaseQuery.isError ? "unavailable" : "loading")} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Thumbnail cleanup" styles={styles} type={type}>
        <DiagnosticRow label="Latest attempt" value={cleanup ? cleanupLabels[cleanup.state] : "Loading"} styles={styles} type={type} />
        <DiagnosticRow label="Disk / memory" value={cleanup ? `${cleanup.diskCleared === null ? "not confirmed" : cleanup.diskCleared ? "cleared" : "not cleared"} / ${cleanup.memoryCleared === null ? "not confirmed" : cleanup.memoryCleared ? "cleared" : "not cleared"}` : "Loading"} styles={styles} type={type} />
        <DiagnosticRow label="Attempt time" value={cleanup?.attemptedAt ? new Date(cleanup.attemptedAt).toLocaleString() : "No native attempt this launch"} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Services" styles={styles} type={type}>
        <DiagnosticRow label="Video service" value="Direct YouTube API · key managed in Settings" styles={styles} type={type} />
        <DiagnosticRow label="Google on this device" value={isGooglePlatformConfigured() ? `${APP_ENV} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Storage mode" value={database?.storage === "sqlite" ? "persistent on device" : database ? "preview only; resets on refresh" : databaseQuery.isError ? "unavailable" : "checking storage"} styles={styles} type={type} />
      </DiagnosticSection>
      </InlineHelp></View>
    </ScrollView>
  );
}

function DiagnosticSection({
  title,
  children,
  styles,
  type,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  type: FrameType;
}) {
  return (
    <View style={styles.section}>
      <Heading style={type.caption}>{title}</Heading>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function DiagnosticRow({
  label,
  value,
  styles,
  type,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  type: FrameType;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[type.bodySoft, styles.value]} selectable>{value}</Text>
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    intro: { paddingHorizontal: spacing.page, gap: spacing.sm },
    section: { marginTop: spacing.md, gap: spacing.sm },
    card: {
      backgroundColor: palette.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: palette.borderSoft,
      overflow: "hidden",
    },
    row: {
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.borderSoft,
      gap: spacing.xs,
    },
    label: { ...type.label, color: palette.ink },
    value: { color: palette.inkMuted },
  });
}

