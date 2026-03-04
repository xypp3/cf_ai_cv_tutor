import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        editor: resolve(__dirname, "editor.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        "content/scrape": resolve(__dirname, "src/content/scrape.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background.js";
          if (chunkInfo.name === "content/scrape") return "content/scrape.js";
          return "[name].js";
        }
      }
    },
    outDir: "dist"
  }
});
