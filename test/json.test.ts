import { describe, expect, it } from "vitest";
import { parseAiJson } from "../src/json";

describe("parseAiJson", () => {
  it("unwraps structured Workers AI JSON Mode responses", () => {
    const parsed = parseAiJson<{ value: string }>({
      response: {
        value: "ok"
      }
    });

    expect(parsed).toEqual({ value: "ok" });
  });

  it("parses string response bodies", () => {
    const parsed = parseAiJson<{ value: string }>({
      response: '{"value":"ok"}'
    });

    expect(parsed).toEqual({ value: "ok" });
  });
});
