/**
 * Reset + seed script. Compiles TypeScript on the fly with tsx.
 */

import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "scripts/seed.ts"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
