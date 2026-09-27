import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import { hashPassword } from "./hash-password.mjs";

// Verify the way the Worker does (apps/api/src/lib/password.ts): PBKDF2-SHA256 through WebCrypto.
async function verify(password, stored) {
  const [scheme, iter, salt, hash] = stored.split("$");
  assert.equal(scheme, "pbkdf2-sha256");
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(salt, "base64"), iterations: Number(iter) },
    key,
    256,
  );
  return Buffer.from(bits).toString("base64") === hash;
}

test("hashes in the format the Worker verifies, with the Worker's iteration count", async () => {
  const h = hashPassword("mat-khau-moi-cua-co");
  assert.match(h, /^pbkdf2-sha256\$30000\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}$/);
  assert.equal(await verify("mat-khau-moi-cua-co", h), true);
  assert.equal(await verify("mat-khau-khac", h), false);
});

test("refuses a password shorter than a teacher's minimum", () => {
  assert.throws(() => hashPassword("ngan"), /8/);
});
