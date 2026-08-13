import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Set on the prod server (docker-compose `environment:` block) to
// `ims.srotaapps.com`. When unset (local dev), HMR falls back to same-origin
// ws:// on the dev port — which is what we want for `bun run dev` on a laptop.
// Without this, behind an HTTPS nginx the browser tries `wss://<host>:3004`
// which nginx isn't proxying, HMR silently fails, and the page just hangs
// on the initial shell.
const HMR_HOST = process.env.VITE_HMR_HOST;

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3004,
    strictPort: true,
    allowedHosts: HMR_HOST ? [HMR_HOST] : undefined,
    hmr: HMR_HOST
      ? { protocol: "wss", host: HMR_HOST, clientPort: 443 }
      : undefined,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
