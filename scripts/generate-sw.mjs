import { generateSW } from "workbox-build";

// vite-plugin-pwa skips service-worker generation when Vite runs more than one
// build environment (TanStack Start builds client + SSR in one command), so the
// worker is emitted here after both environments have finished writing.
const { count, size, warnings } = await generateSW({
  globDirectory: "dist/client",
  globPatterns: ["**/*.{js,css,ico,png,svg,webmanifest}"],
  swDest: "dist/client/sw.js",
  navigateFallback: null,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
});

for (const warning of warnings) {
  console.warn(`[pwa] ${warning}`);
}

console.log(
  `[pwa] generated sw.js with ${count} precached files (${(size / 1024).toFixed(1)} KiB)`
);
