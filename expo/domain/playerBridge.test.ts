import { describe, expect, test } from "bun:test";
import { parsePlayerBridgeMessage } from "./playerBridge";

describe("native player bridge boundary", () => {
  test("preserves valid playback and lifecycle messages", () => {
    for (const message of [
      { type: "ready", duration: 400 },
      { type: "progress", current: 12.5, duration: 400 },
      { type: "state", state: 0 }, { type: "error", code: 153 },
      { type: "fullscreen", isFullscreen: false },
      { type: "connectivity", isOnline: true }, { type: "shellError" },
    ]) expect(parsePlayerBridgeMessage(JSON.stringify(message))).toEqual(message);
  });

  test("rejects malformed messages instead of coercing them into playback state", () => {
    for (const raw of [
      "null", "[]", "not json", "{}", ' {"type":"ready","duration":1e400}',
      '{"type":"progress","current":"20","duration":400}',
      '{"type":"progress","current":-20,"duration":400}',
      '{"type":"ready"}', '{"type":"state","state":9}',
      '{"type":"fullscreen","isFullscreen":"false"}',
      '{"type":"error","code":{}}', " ".repeat(1_025),
    ]) expect(parsePlayerBridgeMessage(raw)).toBe(null);
  });
});
