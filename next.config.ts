import type { NextConfig } from "next";
import path from "node:path";
import fs from "node:fs";

// Only initialise Cloudflare dev bindings when running locally (npm run dev).
// In production, Cloudflare provides bindings automatically via the Worker runtime.
if (process.env.NODE_ENV === "development") {
  // `require` is deliberate here, and an `import` cannot replace it: imports
  // are hoisted and evaluated unconditionally, so the dev-only Cloudflare
  // shim would be pulled into production builds as well.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

// Pin Turbopack's workspace root to the nearest ancestor that owns a
// `node_modules`. Session worktrees (if an assistant uses them) share the
// parent checkout's packages; pinning `__dirname` alone would make `next`
// unresolvable from inside one. Walking up finds the parent when in a
// worktree and stays put otherwise. Carried from MyNclex.
function findProjectRoot(start: string): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, "node_modules"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: findProjectRoot(__dirname),
  },
  // A file uploaded through a Server Action travels in its body, which
  // Next caps at 1 MB by default. The product's uploads (a profile photo,
  // a rationale image) allow 2 MB, as legacy did when the browser sent
  // them straight to storage; the cap sits above that to leave room for
  // the other fields and the multipart framing (AGENTS.md, Known
  // Workarounds).
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
