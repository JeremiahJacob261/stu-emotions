import { MAX_HISTORY_ITEM_CHARS, MAX_HISTORY_ITEMS, MAX_MESSAGE_CHARS } from "./constants";
import type { ChatRequestBody, HistoryItem } from "./types";

export class RequestValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function validateChatBody(body: unknown): { message: string; history: HistoryItem[] } {
  if (!body || typeof body !== "object") {
    throw new RequestValidationError("Request body must be a JSON object.");
  }

  const { message, history } = body as ChatRequestBody;
  if (typeof message !== "string" || message.trim().length === 0) {
    throw new RequestValidationError("Message is required.");
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > MAX_MESSAGE_CHARS) {
    throw new RequestValidationError(`Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`, 413);
  }

  return {
    message: cleanMessage,
    history: sanitizeHistory(history)
  };
}

export function sanitizeHistory(history: unknown): HistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item): item is HistoryItem => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as HistoryItem;
      return (candidate.role === "student" || candidate.role === "assistant") && typeof candidate.content === "string";
    })
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_HISTORY_ITEM_CHARS)
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_ITEMS);
}
