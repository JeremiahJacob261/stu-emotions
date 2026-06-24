import { EMOTION_LABELS, TOP_EMOTION_THRESHOLD } from "./constants";
import type { EmotionLabel, EmotionScore, RiskLevel } from "./types";

const labelSet = new Set<string>(EMOTION_LABELS);

interface RawEmotionItem {
  label?: unknown;
  score?: unknown;
}

export interface RawEmotionPayload {
  emotions?: unknown;
  scores?: unknown;
  riskLevel?: unknown;
}

export interface NormalizedEmotionPayload {
  emotions: EmotionScore[];
  topEmotions: EmotionScore[];
  riskLevel: RiskLevel;
}

export function normalizeEmotionPayload(payload: RawEmotionPayload): NormalizedEmotionPayload {
  const scoreMap = new Map<EmotionLabel, number>();
  for (const label of EMOTION_LABELS) {
    scoreMap.set(label, 0);
  }

  const raw = payload.emotions ?? payload.scores;
  if (Array.isArray(raw)) {
    for (const item of raw as RawEmotionItem[]) {
      addScore(scoreMap, item.label, item.score);
    }
  } else if (raw && typeof raw === "object") {
    for (const [label, score] of Object.entries(raw)) {
      addScore(scoreMap, label, score);
    }
  } else if (payload && typeof payload === "object") {
    for (const [label, score] of Object.entries(payload)) {
      addScore(scoreMap, label, score);
    }
  }

  const emotions = EMOTION_LABELS.map((label) => ({
    label,
    score: roundScore(scoreMap.get(label) ?? 0)
  })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return {
    emotions,
    topEmotions: emotions.filter((emotion) => emotion.score > TOP_EMOTION_THRESHOLD),
    riskLevel: normalizeRiskLevel(payload.riskLevel)
  };
}

export function detectKeywordRisk(message: string): RiskLevel {
  const normalized = message.toLowerCase();
  const highRiskPatterns = [
    /\bkill myself\b/,
    /\bend my life\b/,
    /\bi want to die\b/,
    /\bwant to die\b/,
    /\bsuicide\b/,
    /\bsuicidal\b/,
    /\bself[-\s]?harm\b/,
    /\bhurt myself\b/,
    /\bi am being abused\b/,
    /\bsexual assault\b/,
    /\brape\b/,
    /\bnot safe at home\b/
  ];

  if (highRiskPatterns.some((pattern) => pattern.test(normalized))) {
    return "high";
  }

  const lowRiskPatterns = [
    /\bhopeless\b/,
    /\bpanic\b/,
    /\boverwhelmed\b/,
    /\bcan't cope\b/,
    /\bcannot cope\b/,
    /\bworthless\b/
  ];

  return lowRiskPatterns.some((pattern) => pattern.test(normalized)) ? "low" : "none";
}

export function maxRiskLevel(...levels: RiskLevel[]): RiskLevel {
  if (levels.includes("high")) {
    return "high";
  }

  if (levels.includes("low")) {
    return "low";
  }

  return "none";
}

export function normalizeRiskLevel(value: unknown): RiskLevel {
  return value === "low" || value === "high" ? value : "none";
}

function addScore(scoreMap: Map<EmotionLabel, number>, rawLabel: unknown, rawScore: unknown) {
  if (typeof rawLabel !== "string" || !labelSet.has(rawLabel)) {
    return;
  }

  scoreMap.set(rawLabel as EmotionLabel, normalizeScore(rawScore));
}

function normalizeScore(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const percentage = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Math.min(100, Math.max(0, percentage));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
