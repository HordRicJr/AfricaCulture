import { config } from "./config";

/**
 * foundryClient — the ONLY place that talks to Microsoft AI Foundry.
 *
 * Two flows are supported (selected by FOUNDRY_MODE):
 *
 *  - "agent":  POST {projectEndpoint}/openai/v1/responses
 *              body includes `agent_reference` { name, version, type }.
 *              This mirrors the Python azure-ai-projects sample:
 *              `project_client.get_openai_client()` resolves its base_url to
 *              `{projectEndpoint}/openai/v1`, and `agent_reference` is passed in
 *              the request body.
 *
 *  - "model":  POST {openaiEndpoint}/responses with `model: "gpt-4.1"`.
 *              Direct call to a deployed model (Azure OpenAI v1 surface).
 *
 * Authentication is either the resource API key (`api-key` header) or a
 * Microsoft Entra ID bearer token (recommended for production).
 */

export type ChatRole = "user" | "assistant" | "system";

export interface WireMessage {
  role: ChatRole;
  content: string;
}

interface BuiltRequest {
  url: string;
  body: Record<string, unknown>;
}

type Credential = { getToken(scope: string): Promise<{ token: string } | null> };
let cachedCredential: Credential | undefined;

const ENTRA_SCOPE = "https://ai.azure.com/.default";

async function resolveAuthHeaders(): Promise<Record<string, string>> {
  if (config.authMode === "entra") {
    if (!cachedCredential) {
      // Lazy import so the SDK is only loaded when Entra auth is actually used.
      const { DefaultAzureCredential } = await import("@azure/identity");
      cachedCredential = new DefaultAzureCredential();
    }
    const token = await cachedCredential.getToken(ENTRA_SCOPE);
    if (!token) {
      throw new Error("Impossible d'obtenir un jeton Microsoft Entra ID.");
    }
    return { Authorization: `Bearer ${token.token}` };
  }

  // Default: resource API key.
  return { "api-key": config.apiKey };
}

function buildRequest(messages: WireMessage[], stream: boolean): BuiltRequest {
  const input = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (config.mode === "agent") {
    return {
      url: `${config.projectEndpoint}/openai/v1/responses`,
      body: {
        input,
        stream,
        agent_reference: {
          name: config.agentName,
          version: config.agentVersion,
          type: "agent_reference",
        },
      },
    };
  }

  return {
    url: `${config.openaiEndpoint}/responses`,
    body: { model: config.model, input, stream },
  };
}

/** Issue the Responses API call and return the raw fetch Response. */
export async function createFoundryResponse(
  messages: WireMessage[],
  stream: boolean,
  signal?: AbortSignal,
): Promise<Response> {
  const { url, body } = buildRequest(messages, stream);
  const authHeaders = await resolveAuthHeaders();

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
    signal,
  });
}

/* ------------------------------------------------------------------ */
/* Response parsing helpers (Responses API shape)                      */
/* ------------------------------------------------------------------ */

interface ResponsesPayload {
  id?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

/** Extract the assistant text from a non-streaming Responses payload. */
export function extractOutputText(payload: unknown): string {
  const data = payload as ResponsesPayload | null;
  if (!data) {
    return "";
  }
  if (typeof data.output_text === "string") {
    return data.output_text;
  }
  if (Array.isArray(data.output)) {
    const parts: string[] = [];
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const chunk of item.content) {
          if (
            (chunk?.type === "output_text" || chunk?.type === "text") &&
            typeof chunk.text === "string"
          ) {
            parts.push(chunk.text);
          }
        }
      }
    }
    return parts.join("");
  }
  return "";
}

export function extractResponseId(payload: unknown): string {
  const data = payload as ResponsesPayload | null;
  return data && typeof data.id === "string" ? data.id : "";
}
