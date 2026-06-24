import { JsonParseError } from "./json";
import { buildCoachResponse } from "./ai";
import type { Env } from "./types";
import { RequestValidationError, validateChatBody } from "./validation";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "student-emotion-coach" });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405);
      }

      return handleChat(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

export async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { message, history } = validateChatBody(body);
    const response = await buildCoachResponse(env, message, history);

    return json(response);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json({ error: error.message }, error.status);
    }

    if (error instanceof SyntaxError) {
      return json({ error: "Request body must be valid JSON." }, 400);
    }

    if (error instanceof JsonParseError) {
      return json({ error: "The AI response could not be parsed. Please try again." }, 502);
    }

    console.error(error);
    return json({ error: "Unexpected server error." }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
