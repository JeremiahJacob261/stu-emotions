export const WORKERS_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

export const EMOTION_LABELS = [
  "admiration",
  "amusement",
  "anger",
  "annoyance",
  "approval",
  "caring",
  "confusion",
  "curiosity",
  "desire",
  "disappointment",
  "disapproval",
  "disgust",
  "embarrassment",
  "excitement",
  "fear",
  "gratitude",
  "grief",
  "joy",
  "love",
  "nervousness",
  "optimism",
  "pride",
  "realization",
  "relief",
  "remorse",
  "sadness",
  "surprise",
  "neutral"
] as const;

export const TOP_EMOTION_THRESHOLD = 30;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_ITEMS = 8;
export const MAX_HISTORY_ITEM_CHARS = 700;
