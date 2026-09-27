/**
 * Prints a password hash the Worker accepts, for resetting a teacher's password by hand (there is no email reset).
 * Reads the password from the terminal without echoing it, so it never lands in shell history. See docs/DEPLOY.md.
 *
 *   node scripts/hash-password.mjs
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Kept in step with PBKDF2_ITERATIONS in apps/api/src/lib/password.ts.
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../apps/api/src/lib/password.ts"), "utf8");
const ITERATIONS = Number(source.match(/PBKDF2_ITERATIONS = ([\d_]+)/)[1].replace(/_/g, ""));

export function hashPassword(password) {
  if (password.length < 8) throw new Error("A teacher's password needs at least 8 characters.");
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function ask(prompt) {
  process.stdout.write(prompt);
  process.stdin.setRawMode?.(true);
  let value = "";
  for await (const chunk of process.stdin) {
    for (const ch of chunk.toString("utf8")) {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode?.(false);
        process.stdout.write("\n");
        return value;
      }
      if (ch === "\u0003") process.exit(1);
      if (ch === "\u007f") value = value.slice(0, -1);
      else value += ch;
    }
  }
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const password = await ask("New password (not shown): ");
  console.log(hashPassword(password));
  process.exit(0);
}
