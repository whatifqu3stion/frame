import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, Share, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_ENV,
  IS_CLOSED_BETA,
  RELEASE_CHANNEL_LABEL,
  FEATURE_FLAGS,
  isGooglePlatformConfigured,
} from "@/constants/config";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { DATABASE_SCHEMA_VERSION, getDatabaseDiagnostics, type DatabaseDiagnostics } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { isRevenueCatConfigured } from "@/services/revenueCat";
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
  if (!IS_CLOSED_BETA) return <Redirect href="/(tabs)/settings" />;
  return <DiagnosticsScreen />;
}

function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  const { premiumAccessState, activeProfileId } = useApp();
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
  const entitlementState = !FEATURE_FLAGS.paidAccess ? "free beta; purchases disabled" : premiumAccessState === "active" ? "premium active" : premiumAccessState;
  const database = databaseQuery.data;
  const flags = {
    ...FEATURE_FLAGS,
    googleCurrentPlatform: isGooglePlatformConfigured(),
    revenueCat: FEATURE_FLAGS.paidAccess && isRevenueCatConfigured,
  };

  const shareStatus = async (): Promise<void> => {
    const message = [`Frame ${Constants.expoConfig?.version ?? "unknown"}`, `Environment: ${APP_ENV}`, `Release: ${RELEASE_CHANNEL_LABEL}`, `Access: ${entitlementState}`, `Database: ${database?.version ?? "unavailable"}`, `Storage: ${database?.storage ?? "unavailable"}`, `Thumbnail cleanup: ${cleanup ? cleanupLabels[cleanup.state] : "unknown"}`, ...Object.entries(flags).map(([name, enabled]) => `${name}: ${enabled ? "enabled" : "disabled"}`)].join("\n");
    try { await Share.share({ title: "Frame support status", message }); } catch { Alert.alert("Couldn’t share status", "You can select and copy the status values below."); }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={type.caption}>{RELEASE_CHANNEL_LABEL}</Text>
        <Text style={type.title}>Beta support</Text>
        <Text style={type.bodySoft}>Safe configuration and readiness status. Credentials and tokens are never shown.</Text>
      </View>

      <Pressable onPress={() => { void shareStatus(); }} accessibilityRole="button" style={{ minHeight: 48, margin: spacing.page, padding: spacing.md, borderRadius: radii.control, backgroundColor: palette.accentDeep, alignItems: "center" }}><Text style={[type.label, { color: palette.onDark }]}>Share support status</Text></Pressable>
      <DiagnosticSection title="Runtime" styles={styles} type={type}>
        <DiagnosticRow label="App version" value={Constants.expoConfig?.version ?? "unknown"} styles={styles} type={type} />
        <DiagnosticRow label="Environment" value={APP_ENV} styles={styles} type={type} />
        <DiagnosticRow label="Release channel" value={RELEASE_CHANNEL_LABEL} styles={styles} type={type} />
        <DiagnosticRow label="Active profile ID" value={activeProfileId} styles={styles} type={type} />
        <DiagnosticRow label="Entitlement" value={entitlementState} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Persistence" styles={styles} type={type}>
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
        <DiagnosticRow label="Device verification" value="API results are not a full device acceptance test. Confirm retained links, progress and Session order after restart and offline. Videos still require internet." styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Beta readiness" styles={styles} type={type}>
        <DiagnosticRow label="Video service" value={FEATURE_FLAGS.knownYouTubeUrlResolution ? `${APP_ENV} shared cache configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Google on this device" value={isGooglePlatformConfigured() ? `${APP_ENV} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Premium service" value={!FEATURE_FLAGS.paidAccess ? "disabled for free beta" : isRevenueCatConfigured ? `${APP_ENV === "production" ? "production" : "test"} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Storage mode" value={database?.storage === "sqlite" ? "persistent on device" : database ? "preview only; resets on refresh" : databaseQuery.isError ? "unavailable" : "checking storage"} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Feature flags" styles={styles} type={type}>
        {Object.entries(flags).map(([label, enabled]) => (
          <DiagnosticRow key={label} label={label} value={enabled ? "enabled" : "disabled"} styles={styles} type={type} />
        ))}
      </DiagnosticSection>
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
      <Text accessibilityRole="header" style={type.caption}>{title}</Text>
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
    root: { flex: 1, backgroundColor: palette.wall },
    intro: { paddingHorizontal: spacing.page, gap: spacing.sm },
    section: { paddingHorizontal: spacing.page, marginTop: spacing.xl, gap: spacing.sm },
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

