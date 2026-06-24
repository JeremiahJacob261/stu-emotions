import { EMOTION_LABELS, WORKERS_AI_MODEL } from "./constants";
import { detectKeywordRisk, maxRiskLevel, normalizeEmotionPayload, normalizeRiskLevel } from "./emotions";
import { JsonParseError, parseAiJson } from "./json";
import type { ChatResponseBody, EmotionScore, Env, HistoryItem, RiskLevel } from "./types";

interface AdvicePayload {
  assistantMessage?: unknown;
  nextSteps?: unknown;
  riskLevel?: unknown;
}

interface EmotionPromptPayload {
  emotions?: unknown;
  scores?: unknown;
  riskLevel?: unknown;
}

export async function buildCoachResponse(env: Env, message: string, history: HistoryItem[]): Promise<ChatResponseBody> {
  const keywordRisk = detectKeywordRisk(message);
  const emotionPayload = await runJsonWithRetry<EmotionPromptPayload>(env, buildEmotionPrompt(message));
  const normalized = normalizeEmotionPayload(emotionPayload);
  const riskLevel = maxRiskLevel(keywordRisk, normalized.riskLevel);
  const advicePayload = await runJsonWithRetry<AdvicePayload>(
    env,
    buildAdvicePrompt({
      message,
      history,
      emotions: normalized.emotions,
      topEmotions: normalized.topEmotions,
      riskLevel
    })
  );

  return {
    emotions: normalized.emotions,
    topEmotions: normalized.topEmotions,
    assistantMessage: normalizeAssistantMessage(advicePayload.assistantMessage, riskLevel),
    nextSteps: normalizeNextSteps(advicePayload.nextSteps, riskLevel),
    riskLevel: maxRiskLevel(riskLevel, normalizeRiskLevel(advicePayload.riskLevel))
  };
}

async function runJsonWithRetry<T>(env: Env, input: Record<string, unknown>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0 ? input : addRepairInstruction(input);
    const response = await runModelWithJsonFallback(env, prompt);

    try {
      return parseAiJson<T>(response);
    } catch (error) {
      lastError = error;
      if (!(error instanceof JsonParseError)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new JsonParseError();
}

async function runModelWithJsonFallback(env: Env, input: Record<string, unknown>): Promise<unknown> {
  try {
    return await env.AI.run(WORKERS_AI_MODEL, input);
  } catch (error) {
    if ("response_format" in input && shouldRetryWithoutJsonMode(error)) {
      const { response_format: _responseFormat, ...fallbackInput } = input;
      return env.AI.run(WORKERS_AI_MODEL, fallbackInput);
    }

    throw error;
  }
}

function buildEmotionPrompt(message: string): Record<string, unknown> {
  return {
    messages: [
      {
        role: "system",
        content: [
          "You score student writing with GoEmotions-style labels.",
          "Return valid JSON only.",
          "Scores are independent confidence percentages from 0 to 100 and do not need to sum to 100.",
          "Use exactly these labels:",
          EMOTION_LABELS.join(", "),
          "Also set riskLevel to none, low, or high."
        ].join(" ")
      },
      {
        role: "user",
        content: `Student message:\n${message}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        additionalProperties: false,
        required: ["emotions", "riskLevel"],
        properties: {
          emotions: {
            type: "array",
            minItems: EMOTION_LABELS.length,
            maxItems: EMOTION_LABELS.length,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "score"],
              properties: {
                label: { type: "string", enum: EMOTION_LABELS },
                score: { type: "number", minimum: 0, maximum: 100 }
              }
            }
          },
          riskLevel: { type: "string", enum: ["none", "low", "high"] }
        }
      }
    },
    temperature: 0,
    max_tokens: 2200
  };
}

function buildAdvicePrompt(input: {
  message: string;
  history: HistoryItem[];
  emotions: EmotionScore[];
  topEmotions: EmotionScore[];
  riskLevel: RiskLevel;
}): Record<string, unknown> {
  const recentHistory = input.history
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n")
    .slice(0, 5000);

  return {
    messages: [
      {
        role: "system",
        content: [
          "You are a supportive student emotion coach.",
          "You are not a therapist, doctor, or diagnosis tool.",
          "Explain the emotion signal in plain language, then suggest practical next steps for school, studying, relationships, or self-care.",
          "Keep the tone warm, direct, age-appropriate, and non-judgmental.",
          "If riskLevel is high, prioritize immediate safety: tell the student to contact a trusted adult, school counselor, local emergency services, or a crisis line now.",
          "Return valid JSON only with assistantMessage, nextSteps, and riskLevel."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          currentStudentMessage: input.message,
          recentHistory,
          emotions: input.emotions,
          topEmotions: input.topEmotions,
          riskLevel: input.riskLevel
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        additionalProperties: false,
        required: ["assistantMessage", "nextSteps", "riskLevel"],
        properties: {
          assistantMessage: { type: "string" },
          nextSteps: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" }
          },
          riskLevel: { type: "string", enum: ["none", "low", "high"] }
        }
      }
    },
    temperature: 0.35,
    max_tokens: 900
  };
}

function addRepairInstruction(input: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(input.messages) ? [...input.messages] : [];

  return {
    ...input,
    messages: [
      ...messages,
      {
        role: "user",
        content: "Your previous answer was not valid JSON. Reply again with valid JSON only and no markdown."
      }
    ],
    temperature: 0
  };
}

function shouldRetryWithoutJsonMode(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /json mode|response_format|schema|7504|validation/i.test(message);
}

function normalizeAssistantMessage(value: unknown, riskLevel: RiskLevel): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (riskLevel === "high") {
    return "Your message sounds urgent. Please contact a trusted adult, school counselor, local emergency services, or a crisis line now so you do not have to handle this alone.";
  }

  return "I noticed a few emotional signals in what you wrote. Let us slow it down, name what may be happening, and choose one small next step.";
}

function normalizeNextSteps(value: unknown, riskLevel: RiskLevel): string[] {
  if (Array.isArray(value)) {
    const steps = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    if (steps.length > 0) {
      return steps.slice(0, 4);
    }
  }

  if (riskLevel === "high") {
    return [
      "Move near a trusted person if you can.",
      "Contact a trusted adult, school counselor, emergency services, or a crisis line now.",
      "Avoid staying alone with anything you could use to hurt yourself."
    ];
  }

  return ["Write down the main feeling.", "Choose one manageable action you can do in the next 10 minutes."];
}
