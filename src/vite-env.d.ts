/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL the SPA calls to reach the BFF chat endpoint (default: /api/chat). */
  readonly VITE_CHAT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
