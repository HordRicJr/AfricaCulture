import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SPA never talks to Foundry directly. In development, Vite proxies every
// request beginning with "/api" to the BFF, so the browser and the proxy share
// an origin and the Foundry API key stays server-side.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
