import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa/icon.svg"],
      manifest: {
        name: "Spbook",
        short_name: "Spbook",
        description: "Offline-first accounting without a database.",
        theme_color: "#f5f4ed",
        background_color: "#f5f4ed",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"]
      }
    })
  ],
  test: {
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
