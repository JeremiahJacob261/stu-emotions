export class JsonParseError extends Error {
  constructor(message = "AI response was not valid JSON") {
    super(message);
    this.name = "JsonParseError";
  }
}

export function extractAiText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (!result || typeof result !== "object") {
    return "";
  }

  const record = result as Record<string, unknown>;
  const direct = record.response ?? record.result ?? record.text;
  if (typeof direct === "string") {
    return direct;
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = message?.content ?? first?.text;
    if (typeof content === "string") {
      return content;
    }
  }

  return JSON.stringify(result);
}

export function parseAiJson<T>(result: unknown): T {
  if (result && typeof result === "object" && !("response" in result) && !("choices" in result)) {
    return result as T;
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const structured = record.response ?? record.result;
    if (structured && typeof structured === "object") {
      return structured as T;
    }
  }

  const text = extractAiText(result).trim();
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as T;
  } catch {
    const match = withoutFence.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new JsonParseError();
    }

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      throw new JsonParseError();
    }
  }
}
