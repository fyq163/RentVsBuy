import { defineConfig } from "vitest/config";

// Relative base so GitHub Pages project sites and local preview both work.
export default defineConfig({
  base: "./",
  test: {
    environment: "node",
  },
});
