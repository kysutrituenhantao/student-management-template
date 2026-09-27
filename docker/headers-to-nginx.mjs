// Turn the "/*" block of a Cloudflare `_headers` file into nginx add_header lines,
// so local responses carry the same CSP and security headers as production.
import { readFileSync } from "node:fs";

const lines = readFileSync(process.argv[2], "utf8").split("\n");
let inGlobal = false;
for (const line of lines) {
  if (!line.trim()) { inGlobal = false; continue; }
  if (!line.startsWith(" ")) { inGlobal = line.trim() === "/*"; continue; }
  if (!inGlobal) continue;
  const i = line.indexOf(":");
  const name = line.slice(0, i).trim();
  const value = line.slice(i + 1).trim().replace(/"/g, '\\"');
  console.log(`add_header ${name} "${value}" always;`);
}
