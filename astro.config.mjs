// @ts-check
import { defineConfig } from "astro/config";

// A static site: `astro build` writes dist/, and Cloudflare serves it as is (see wrangler.jsonc).
export default defineConfig({
  site: "https://skaur.dev",
  output: "static",
  compressHTML: false, // the player reads some of the page's whitespace; keep the markup exactly as written
  devToolbar: { enabled: false },
  build: { inlineStylesheets: "never" },
});
