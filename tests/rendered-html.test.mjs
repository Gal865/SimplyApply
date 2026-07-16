import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the core Shortlist interface and private deployment gate", async () => {
  const [app, proxy, packageJson] = await Promise.all([
    readFile(new URL("../app/shortlist-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Jobs to review/);
  assert.match(app, /What job are you looking for\?/);
  assert.match(app, /Upload your resume/);
  assert.doesNotMatch(app, /Minimum salary/);
  assert.match(proxy, /APP_PASSWORD/);
  assert.equal(JSON.parse(packageJson).scripts.build, "next build");
});
