import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  base: "./",
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          database: ["sql.js"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@cervos/core": path.resolve(__dirname, "../packages/core/src/index.ts"),
      "@cervos/db": path.resolve(__dirname, "../packages/db/src/index.ts"),
      "@cervos/intelligence": path.resolve(__dirname, "../packages/intelligence/src/index.ts"),
      "@cervos/i18n": path.resolve(__dirname, "../packages/i18n/src/index.ts"),
      "@cervos/ui": path.resolve(__dirname, "../packages/ui/src/index.tsx"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "sql.js"],
  },
});
