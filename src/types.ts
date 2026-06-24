import type { EMOTION_LABELS } from "./constants";

export type EmotionLabel = (typeof EMOTION_LABELS)[number];
export type ChatRole = "student" | "assistant";
export type RiskLevel = "none" | "low" | "high";

export interface EmotionScore {
  label: EmotionLabel;
  score: number;
}

export interface HistoryItem {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  message: string;
  history?: HistoryItem[];
}

export interface ChatResponseBody {
  emotions: EmotionScore[];
  topEmotions: EmotionScore[];
  assistantMessage: string;
  nextSteps: string[];
  riskLevel: RiskLevel;
}

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  AI: AiBinding;
  ASSETS: Fetcher;
}
