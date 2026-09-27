// Writes the Worker secrets present in the environment to a JSON file for `wrangler deploy --secrets-file`.
// Missing secrets are skipped (the Worker keeps its previous value) and flagged in the Actions log.
import { writeFileSync } from "node:fs";

const KEYS = ["TEACHER_INVITE_CODE"];
const out = process.argv[2] ?? "/tmp/secrets.json";
const secrets = Object.fromEntries(KEYS.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
for (const k of KEYS) {
  if (!process.env[k]) console.log(`::warning::${k} is not set; the Worker keeps its previous value, if any.`);
}
writeFileSync(out, JSON.stringify(secrets), { mode: 0o600 });
console.log(`wrote ${Object.keys(secrets).length} of ${KEYS.length} secrets`);
