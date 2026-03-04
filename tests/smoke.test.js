import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = process.cwd();
const manifestPath = join(root, "manifest.json");
assert(existsSync(manifestPath), "manifest.json missing");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.background?.service_worker, "background.service_worker missing");
assert(manifest.action?.default_popup === "popup.html", "default_popup must be popup.html");
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes("storage"), "storage permission missing");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, "content_scripts missing");

const requiredFiles = [
  "popup.html",
  "options.html",
  "editor.html",
  "src/background/index.ts",
  "src/content/scrape.ts",
  "src/popup/index.ts",
  "src/options/index.ts",
  "src/editor/index.ts",
  "src/lib/ai.ts",
  "src/lib/storage.ts",
  "src/lib/scrape.ts",
  "worker/index.ts"
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `missing required file: ${file}`);
}

console.log("Smoke test passed.");
