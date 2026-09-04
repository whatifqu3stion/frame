export type FullResetDependencies = {
  stopPlayback(): Promise<void>;
  flushPendingWrites(): Promise<void>;
  clearProtectedCredentials(): Promise<void>;
  resetDatabase(): Promise<void>;
  clearKeyValueStorage(): Promise<void>;
  restoreOwnerSelection(): Promise<void>;
};

/** Runs the irreversible local reset in a deterministic order before UI state is rebuilt. */
export async function performFullReset(dependencies: FullResetDependencies): Promise<void> {
  await dependencies.stopPlayback();
  await dependencies.flushPendingWrites();
  await dependencies.clearProtectedCredentials();
  await dependencies.resetDatabase();
  await dependencies.clearKeyValueStorage();
  await dependencies.restoreOwnerSelection();
}
