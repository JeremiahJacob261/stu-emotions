import { describe, expect, it } from "vitest";
import { EMOTION_LABELS } from "../src/constants";
import { detectKeywordRisk, normalizeEmotionPayload } from "../src/emotions";

describe("normalizeEmotionPayload", () => {
  it("returns all 28 labels sorted by score", () => {
    const payload = {
      emotions: [
        { label: "joy", score: 0.83 },
        { label: "sadness", score: 41.2 },
        { label: "neutral", score: 7 }
      ],
      riskLevel: "low"
    };

    const result = normalizeEmotionPayload(payload);

    expect(result.emotions).toHaveLength(EMOTION_LABELS.length);
    expect(result.emotions[0]).toEqual({ label: "joy", score: 83 });
    expect(result.emotions[1]).toEqual({ label: "sadness", score: 41.2 });
    expect(result.topEmotions.map((emotion) => emotion.label)).toEqual(["joy", "sadness"]);
    expect(result.riskLevel).toBe("low");
  });

  it("ignores unknown labels and clamps out-of-range scores", () => {
    const result = normalizeEmotionPayload({
      scores: {
        joy: 180,
        anger: -12,
        unknown: 90
      }
    });

    expect(result.emotions.find((emotion) => emotion.label === "joy")?.score).toBe(100);
    expect(result.emotions.find((emotion) => emotion.label === "anger")?.score).toBe(0);
    expect(result.emotions.some((emotion) => (emotion.label as string) === "unknown")).toBe(false);
  });
});

describe("detectKeywordRisk", () => {
  it("flags explicit immediate-danger language as high risk", () => {
    expect(detectKeywordRisk("I want to kill myself tonight")).toBe("high");
  });

  it("flags distress language as low risk", () => {
    expect(detectKeywordRisk("I feel overwhelmed by exams")).toBe("low");
  });
});
