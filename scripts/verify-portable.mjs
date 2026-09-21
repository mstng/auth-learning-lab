// Verify the shipping embedded-DB configuration with an isolated on-disk DB.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "authlab-verify-"));
const origin = "http://localhost:3100";
const env = {
  ...process.env,
  PORT: "3100",
  LAB_DATA_DIR: dir,
  TEST_BASE_URL: origin,
  NEXT_TELEMETRY_DISABLED: "1",
};
// Deliberately verify the launcher's safe defaults, without an .env file.
delete env.LAB_MODE;
delete env.APP_ORIGIN;
delete env.COOKIE_SECURE;
let app;
async function start(mode = "start") {
  app = spawn(process.execPath, ["scripts/run.mjs", mode], {
    env,
    stdio: "inherit",
  });
  for (let i = 0; i < 90; i++) {
    if (app.exitCode !== null) throw new Error("App exited");
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error("App startup timed out");
}
async function stop() {
  if (app && app.exitCode === null) {
    const ended = new Promise((resolve) => app.once("exit", resolve));
    app.kill("SIGTERM");
    await ended;
  }
}
async function run(args) {
  const p = spawn(process.execPath, args, { env, stdio: "inherit" });
  const code = await new Promise((resolve) => p.once("exit", resolve));
  assert.equal(code, 0, `Failed: ${args.join(" ")}`);
}
const jar = new Map();
async function call(path, method = "GET", body = {}, token) {
  const res = await fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      "X-Lab-Request": "1",
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  assert.equal(res.status, 200);
  return res.json();
}
try {
  await start();
  await run(["--import", "tsx", "--test", "tests/domain.test.ts", "tests/jwt.test.ts"]);
  await run(["--import", "tsx", "--test", "tests/integration.test.ts", "tests/jwt-integration.test.ts"]);
  if (process.env.SKIP_BROWSER !== "true")
    await run(["node_modules/@playwright/test/cli.js", "test"]);
  await call("lab/init", "POST");
  const before = await call("login", "POST", {
    email: "sample@example.com",
    password: "LearnSession!2026",
    ttl: 300,
  });
  const id = before.state.snapshot.sessions[0].id;
  const hashes = before.state.snapshot.users.map((u) => u.password_hash);
  const jwt = await call("jwt/issue", "POST", {
    email: "sample@example.com", password: "LearnSession!2026", ttl: 300,
  });
  await stop();
  await start();
  const after = await call("profile");
  assert.equal(after.state.authenticated, true);
  assert.equal(after.state.snapshot.sessions[0].id, id);
  assert.deepEqual(
    after.state.snapshot.users.map((u) => u.password_hash),
    hashes,
  );
  const jwtAfter = await call("jwt/profile", "GET", {}, jwt.token);
  assert.equal(jwtAfter.code, "valid");
  assert.equal(jwtAfter.keyId, jwt.keyId);
  console.log("PASS: signing key and issued JWT survive production restart.");
  console.log(
    "PASS: users, hashes, Session and Cookie survive production restart.",
  );
  await stop();
  await start("dev");
  const dev = await call("profile");
  assert.equal(dev.state.snapshot.sessions[0].id, id);
  assert.equal((await call("jwt/profile", "GET", {}, jwt.token)).code, "valid");
  console.log(
    "PASS: npm run dev uses the same persisted data and working API.",
  );
  console.log("DOCKER-FREE VERIFICATION PASSED");
} finally {
  await stop();
  await rm(dir, { recursive: true, force: true });
}
