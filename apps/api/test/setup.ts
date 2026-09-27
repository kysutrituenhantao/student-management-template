import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Storage persists across tests in a file, so every test starts from empty tables. Deleting teachers cascades to
// classes and everything under them; sessions and images have no foreign key.
beforeEach(async () => {
  await env.DB.batch(["sessions", "images", "teachers"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});
