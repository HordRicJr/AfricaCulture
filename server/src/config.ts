import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Environment loading & validation for the BFF.
 *
 * Secrets are read here (server-side only). The root ".env" is loaded first,
 * then an optional "server/.env" can override it. These values never reach the
 * browser bundle.
 */

const rootEnv = resolve(__dirname, "..", "..", ".env");
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
}
const localEnv = resolve(__dirname, "..", ".env");
if (existsSync(localEnv)) {
  loadEnv({ path: localEnv, override: true });
}

export type AuthMode = "key" | "entra";
export type FoundryMode = "agent" | "model";

function clean(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).trim();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const config = {
  get port() { return Number.parseInt(clean(process.env.PORT, "8787"), 10) || 8787; },
  get corsOrigins() {
    return clean(process.env.CORS_ORIGINS, "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },

  get authMode() { return clean(process.env.FOUNDRY_AUTH_MODE, "key") as AuthMode; },
  get apiKey() { return clean(process.env.FOUNDRY_API_KEY); },

  get mode() { return clean(process.env.FOUNDRY_MODE, "agent") as FoundryMode; },
  get projectEndpoint() { return stripTrailingSlash(clean(process.env.FOUNDRY_PROJECT_ENDPOINT)); },
  get openaiEndpoint() { return stripTrailingSlash(clean(process.env.FOUNDRY_OPENAI_ENDPOINT)); },

  get agentName() { return clean(process.env.FOUNDRY_AGENT_NAME); },
  get agentVersion() { return clean(process.env.FOUNDRY_AGENT_VERSION, "1"); },
  get model() { return clean(process.env.FOUNDRY_MODEL, "gpt-4.1"); },

  /** Max characters accepted per message (mirrors the client cap). */
  maxInputLength: 4000,
  /** Max number of history messages forwarded upstream. */
  maxMessages: 50,
};

/** Fail fast at boot if a required variable for the chosen mode is missing. */
export function validateConfig(): void {
  const problems: string[] = [];

  if (config.authMode === "key" && !config.apiKey) {
    problems.push("FOUNDRY_API_KEY est requis lorsque FOUNDRY_AUTH_MODE=key.");
  }

  if (config.mode === "agent") {
    if (!config.projectEndpoint) {
      problems.push("FOUNDRY_PROJECT_ENDPOINT est requis lorsque FOUNDRY_MODE=agent.");
    }
    if (!config.agentName) {
      problems.push("FOUNDRY_AGENT_NAME est requis lorsque FOUNDRY_MODE=agent.");
    }
  } else if (!config.openaiEndpoint) {
    problems.push("FOUNDRY_OPENAI_ENDPOINT est requis lorsque FOUNDRY_MODE=model.");
  }

  if (problems.length > 0) {
    throw new Error(`Configuration invalide:\n - ${problems.join("\n - ")}`);
  }
}
