import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  APP_ENV,
  IS_CLOSED_BETA,
  RELEASE_CHANNEL_LABEL,
  BACKEND_BASE_URL,
  FEATURE_FLAGS,
  isGooglePlatformConfigured,
} from "@/constants/config";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { DATABASE_SCHEMA_VERSION, getDatabaseDiagnostics, type DatabaseDiagnostics } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { isRevenueCatConfigured } from "@/services/revenueCat";

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
    queryKey: ["diagnostics", "database"],
    queryFn: getDatabaseDiagnostics,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const entitlementState = premiumAccessState === "active" ? "premium active" : premiumAccessState;
  const database = databaseQuery.data;
  const flags = {
    ...FEATURE_FLAGS,
    googleCurrentPlatform: isGooglePlatformConfigured(),
    revenueCat: isRevenueCatConfigured,
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
          value={database ? `${database.version}${database.version === 0 ? " (unversioned baseline)" : ""}` : `${DATABASE_SCHEMA_VERSION} (loading)`}
          styles={styles}
          type={type}
        />
        <DiagnosticRow label="Storage" value={database?.storage ?? (databaseQuery.isError ? "unavailable" : "loading")} styles={styles} type={type} />
        <DiagnosticRow label="Tables" value={database?.tables.join(", ") ?? "loading"} styles={styles} type={type} />
      </DiagnosticSection>

      <DiagnosticSection title="Beta readiness" styles={styles} type={type}>
        <DiagnosticRow label="Video service" value={BACKEND_BASE_URL ? `${APP_ENV} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Google on this device" value={isGooglePlatformConfigured() ? `${APP_ENV} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Premium service" value={isRevenueCatConfigured ? `${APP_ENV === "production" ? "production" : "test"} configured` : "not configured"} styles={styles} type={type} />
        <DiagnosticRow label="Storage mode" value={database?.storage === "sqlite" ? "persistent on device" : "preview only; resets on refresh"} styles={styles} type={type} />
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
      <Text style={type.caption}>{title}</Text>
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
