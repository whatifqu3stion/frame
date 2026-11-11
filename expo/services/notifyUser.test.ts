import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

test("Today notices use browser dialogs on web and native alerts on phones", () => {
  const source = readFileSync(new URL("./notifyUser.ts", import.meta.url), "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  for (const platform of ["web", "android", "ios"]) {
    const browser: string[] = [];
    const native: string[][] = [];
    const context = { exports: {} as { notifyUser(title: string, message: string): void }, window: { alert: (message: string) => browser.push(message) }, require: () => ({ Platform: { OS: platform }, Alert: { alert: (...values: string[]) => native.push(values) } }) };
    runInNewContext(compiled, context);
    context.exports.notifyUser("Couldn’t save", "Check Saved before trying again.");
    expect(browser).toEqual(platform === "web" ? ["Couldn’t save\n\nCheck Saved before trying again."] : []);
    expect(native).toEqual(platform === "web" ? [] : [["Couldn’t save", "Check Saved before trying again."]]);
  }
});

test("web decisions reach the caller for both acceptance and cancellation without a native alert", () => {
  const source = readFileSync(new URL("./notifyUser.ts", import.meta.url), "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  for (const choice of [false, true]) {
    const decisions: boolean[] = [];
    const context = {
      exports: {} as { confirmUser(title: string, message: string, action: string, decide: (value: boolean) => void): void },
      window: { confirm: () => choice },
      require: () => ({ Platform: { OS: "web" }, Alert: { alert: () => { throw Error("Web confirmation used a native alert"); } } }),
    };
    runInNewContext(compiled, context);
    context.exports.confirmUser("Disconnect?", "Your sources stay in Frame.", "Disconnect", (accepted) => decisions.push(accepted));
    expect(decisions).toEqual([choice]);
  }
});
