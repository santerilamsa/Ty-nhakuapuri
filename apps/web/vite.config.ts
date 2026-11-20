import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /api välitetään API-palvelimelle (packages/api, oletusportti 3001).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.API_URL ?? "http://127.0.0.1:3001" },
  },
});
