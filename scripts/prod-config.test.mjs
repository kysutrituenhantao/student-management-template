import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProductionConfig, parseJsonc } from "./prod-config.mjs";

const base = parseJsonc(`// comment
{
  "name": "lop-hoc-hanh-phuc",
  "main": "src/index.ts",
  "d1_databases": [{ "binding": "DB", "database_name": "lop-hoc-hanh-phuc", "database_id": "0000", "migrations_dir": "migrations" }],
  "ratelimits": [{ "name": "LOGIN_LIMITER", "namespace_id": "2001", "simple": { "limit": 1000, "period": 60 } }],
  "vars": { "ENVIRONMENT": "development", "SITE_URL": "http://localhost:8080" }
}`);

const env = { D1_DATABASE_ID: "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90", SITE_URL: "https://lophochanhphuc.online" };

test("adds the real D1 id, static assets and production vars", () => {
  const c = buildProductionConfig(base, env);
  assert.equal(c.d1_databases[0].database_id, env.D1_DATABASE_ID);
  assert.deepEqual(c.assets, {
    directory: "../web/out",
    binding: "ASSETS",
    run_worker_first: ["/api/*"],
    not_found_handling: "404-page",
    html_handling: "auto-trailing-slash",
  });
  assert.equal(c.vars.ENVIRONMENT, "production");
  assert.equal(c.vars.SITE_URL, "https://lophochanhphuc.online");
  assert.equal(c.workers_dev, true);
  assert.equal(c.routes, undefined);
});

test("attaches the custom domain, and derives SITE_URL from it", () => {
  const c = buildProductionConfig(base, { D1_DATABASE_ID: "x", CUSTOM_DOMAIN: "lophochanhphuc.online" });
  assert.deepEqual(c.routes, [{ pattern: "lophochanhphuc.online", custom_domain: true }]);
  assert.equal(c.vars.SITE_URL, "https://lophochanhphuc.online");
});

test("tightens sign-in attempts to 30 per IP per minute, leaving the base config loose", () => {
  const c = buildProductionConfig(base, env);
  assert.deepEqual(c.ratelimits, [{ name: "LOGIN_LIMITER", namespace_id: "2001", simple: { limit: 30, period: 60 } }]);
  assert.equal(base.ratelimits[0].simple.limit, 1000);
});

test("refuses to build without a database or an https address", () => {
  assert.throws(() => buildProductionConfig(base, { ...env, D1_DATABASE_ID: "" }), /D1_DATABASE_ID/);
  assert.throws(() => buildProductionConfig(base, { D1_DATABASE_ID: "x" }), /SITE_URL or CUSTOM_DOMAIN/);
  assert.throws(() => buildProductionConfig(base, { D1_DATABASE_ID: "x", SITE_URL: "http://example.com" }), /https/);
});

test("parseJsonc strips comments but keeps // inside strings", () => {
  assert.deepEqual(parseJsonc('// x\n{ "u": "https://a.b/c" } // y'), { u: "https://a.b/c" });
});
