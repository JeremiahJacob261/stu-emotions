import { describe, expect, it, vi } from "vitest";
import { EMOTION_LABELS } from "../src/constants";
import worker, { handleChat } from "../src/index";
import type { Env } from "../src/types";

describe("API routes", () => {
  it("returns health status", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/health"), mockEnv());
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("rejects empty chat messages", async () => {
    const response = await handleChat(
      new Request("https://example.com/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "   " })
      }),
      mockEnv()
    );

    expect(response.status).toBe(400);
  });

  it("returns sorted emotion scores and advice", async () => {
    const env = mockEnv([
      {
        response: JSON.stringify({
          emotions: EMOTION_LABELS.map((label) => ({
            label,
            score: label === "joy" ? 76 : label === "nervousness" ? 36 : 2
          })),
          riskLevel: "none"
        })
      },
      {
        response: JSON.stringify({
          assistantMessage: "You sound hopeful but a little tense about what comes next.",
          nextSteps: ["Name the next task.", "Take a five minute reset."],
          riskLevel: "none"
        })
      }
    ]);

    const response = await handleChat(
      new Request("https://example.com/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "I think I did well, but I am still nervous.",
          history: [{ role: "student", content: "I have a test today." }]
        })
      }),
      env
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.emotions).toHaveLength(EMOTION_LABELS.length);
    expect((body.emotions as Array<{ label: string }>)[0].label).toBe("joy");
    expect((body.topEmotions as Array<{ label: string }>).map((emotion) => emotion.label)).toEqual(["joy", "nervousness"]);
    expect(body.assistantMessage).toContain("hopeful");
  });

  it("retries invalid AI JSON once before returning 502", async () => {
    const env = mockEnv([{ response: "not-json" }, { response: "still not json" }]);

    const response = await handleChat(
      new Request("https://example.com/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "I am worried about school." })
      }),
      env
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("could not be parsed");
  });

  it("elevates keyword risk even when the model reports none", async () => {
    const env = mockEnv([
      {
        response: JSON.stringify({
          emotions: EMOTION_LABELS.map((label) => ({ label, score: label === "sadness" ? 88 : 1 })),
          riskLevel: "none"
        })
      },
      {
        response: JSON.stringify({
          assistantMessage: "This sounds urgent. Please contact a trusted adult or emergency support now.",
          nextSteps: ["Go near a trusted person.", "Contact emergency support now."],
          riskLevel: "none"
        })
      }
    ]);

    const response = await handleChat(
      new Request("https://example.com/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "I want to kill myself" })
      }),
      env
    );
    const body = await response.json() as { riskLevel: string };

    expect(response.status).toBe(200);
    expect(body.riskLevel).toBe("high");
  });
});

function mockEnv(responses: unknown[] = []): Env {
  const queue = [...responses];

  return {
    AI: {
      run: vi.fn(async () => queue.shift() ?? { response: "{}" })
    },
    ASSETS: {
      fetch: vi.fn(async () => new Response("asset"))
    } as unknown as Fetcher
  };
}
