import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@cervos/core": path.resolve(__dirname, "./packages/core/src/index.ts"),
      "@cervos/db": path.resolve(__dirname, "./packages/db/src/index.ts"),
      "@cervos/intelligence": path.resolve(__dirname, "./packages/intelligence/src/index.ts"),
      "@cervos/ui": path.resolve(__dirname, "./packages/ui/src/index.tsx"),
      "@cervos/i18n": path.resolve(__dirname, "./packages/i18n/src/index.ts"),
      "@cervos/textify": path.resolve(__dirname, "./packages/textify/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
