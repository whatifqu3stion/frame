import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { migrateDatabase, type MigrationExecutor } from "./migrations";
import { createManagedAllowanceRecord } from "../domain/dailyAllowance";

// Run the production insert and its actual bindings against a migrated SQLite
// database. Substitute only the native Expo driver, which cannot run in Bun.
test("a fresh Managed profile persists its allowance, limit, usage and approval policy together", async () => {
  const db = new Database(":memory:");
  try {
    const driver = {
      execAsync: async (sql: string) => db.exec(sql),
      getFirstAsync: async <T,>(sql: string, args?: unknown) => db.query(sql).get(...(Array.isArray(args) ? args : [])) as T | null,
      getAllAsync: async <T,>(sql: string, args?: unknown) => db.query(sql).all(...(Array.isArray(args) ? args : [])) as T[],
      runAsync: async (sql: string, args: (string | number | null)[]) => db.query(sql).run(...args),
      withTransactionAsync: async (work: () => Promise<void>) => {
        db.exec("BEGIN");
        try { await work(); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; }
      },
    };
    await migrateDatabase(driver as MigrationExecutor);
    const source = readFileSync(new URL("./database.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("database.ts", source, ts.ScriptTarget.ES2022, true);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) &&
      ["insertLocalProfile", "writeManagedAllowanceRecord"].includes(node.name?.text ?? ""));
    const js = ts.transpileModule(functions.map(node => node.getText(ast)).join("\n"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const runtime = { exports: {} as typeof import("./database"), getDb: async () => driver, Platform: { OS: "android" } };
    runInNewContext(js, runtime);
    for (const minutes of [30, null]) {
      const id = `viewer-${minutes}`;
      const profile = { id, name: id, role: "managed" as const, sortOrder: minutes ?? 1, createdAt: 1, updatedAt: 1 };
      await runtime.exports.insertLocalProfile(profile, createManagedAllowanceRecord(id,
        minutes === null ? { mode: "unlimited" } : { mode: "dailyLimit", minutes }, Date.now()));
      expect(db.query("SELECT dailyLimitMinutes,commitment FROM profile_playback_limits WHERE profileId=?").get(id)).toEqual({ dailyLimitMinutes: minutes, commitment: 1 });
      expect(db.query("SELECT consumedSeconds FROM profile_playback_usage WHERE profileId=?").get(id)).toEqual({ consumedSeconds: 0 });
      expect(db.query("SELECT mode FROM managed_content_policies WHERE profileId=?").get(id)).toEqual({ mode: "selectedVideos" });
    }
  } finally { db.close(); }
});
