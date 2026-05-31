import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The shared protocol + Pipecat bridge live in the sibling framework folder
// (../voice-game-framework). Allow Vite to import from there and expose it via
// the `@vgf` alias so the game stays the single source of truth for the schema.
const frameworkDir = path.resolve(__dirname, "../voice-game-framework");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@vgf": frameworkDir,
      // The bridge lives outside this project's tree, so bare Pipecat imports
      // can't walk up to our node_modules. Point them at the installed copies.
      "@pipecat-ai/client-js": path.resolve(__dirname, "node_modules/@pipecat-ai/client-js"),
      "@pipecat-ai/small-webrtc-transport": path.resolve(
        __dirname,
        "node_modules/@pipecat-ai/small-webrtc-transport",
      ),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [__dirname, frameworkDir],
    },
  },
});
