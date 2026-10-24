import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/oura": {
        target: "https://api.ouraring.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oura/, ""),
      },
      "/api/groq": {
        target: "https://api.groq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/api/oura": {
        target: "https://api.ouraring.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oura/, ""),
      },
      "/api/groq": {
        target: "https://api.groq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ""),
      },
    },
  },
});
