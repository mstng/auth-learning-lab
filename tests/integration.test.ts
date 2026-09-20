import { test } from "node:test";
import assert from "node:assert/strict";
import type { Result } from "../src/lib/types";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
class Browser {
  cookies = new Map<string, string>();
  async call(
    path: string,
    method = "GET",
    body?: unknown,
    overrides: Record<string, string> = {},
  ) {
    const response = await fetch(`${base}/api/${path}`, {
      method,
      headers: {
        "X-Lab-Request": "1",
        Origin: base,
        "Content-Type": "application/json",
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...overrides,
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const i = pair.indexOf("=");
      const name = pair.slice(0, i),
        value = pair.slice(i + 1);
      if (/Max-Age=0/i.test(cookie) || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return { response, data: (await response.json()) as Result };
  }
}
const creds = {
  email: "sample@example.com",
  password: "LearnSession!2026",
  ttl: 300,
};
test("full session lifecycle, actual HTTP headers, rotation, replay rejection and isolation", async () => {
  const b = new Browser();
  assert.equal((await b.call("lab/init", "POST")).response.status, 200);
  assert.equal((await b.call("profile")).response.status, 401);
  const password = await b.call("password", "POST", creds);
  assert.equal(password.response.status, 200);
  assert.equal(password.data.state.snapshot.sessions.length, 0);
  assert.equal((await b.call("profile")).response.status, 401);
  const wrong = await b.call("login", "POST", { ...creds, password: "wrong" });
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.data.state.snapshot.sessions.length, 0);
  const missing = await b.call("login", "POST", {
    ...creds,
    email: "absent@example.com",
  });
  assert.equal(missing.response.status, 401);
  assert.equal(missing.data.message, wrong.data.message);
  const login = await b.call("login", "POST", creds);
  assert.equal(login.response.status, 200);
  assert.equal(login.data.trace.length, 9);
  assert.ok(login.response.headers.get("set-cookie")?.includes("HttpOnly"));
  assert.ok(login.response.headers.get("set-cookie")?.includes("SameSite=lax"));
  assert.equal(
    login.response.headers.get("cache-control"),
    "no-store, private",
  );
  const sid = b.cookies.get("lab_session")!;
  assert.match(sid, /^[a-f0-9]{64}$/);
  assert.equal(login.data.state.snapshot.sessions[0].id, sid);
  assert.equal(JSON.stringify(login.data).includes(creds.password), false);
  assert.equal(login.data.trace[5].snapshot?.sessions.length, 0);
  assert.equal(login.data.trace[6].snapshot?.sessions.length, 1);
  const profile = await b.call("profile");
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.trace.length, 4);
  assert.equal(profile.data.state.user?.email, creds.email);
  assert.ok(profile.data.http.requestHeaders.Cookie.includes(sid));
  assert.equal((await b.call("admin")).response.status, 403);
  const other = new Browser();
  await other.call("lab/init", "POST");
  other.cookies.set("lab_session", sid);
  assert.equal((await other.call("profile")).response.status, 401);
  assert.equal(
    (await other.call("lab/state")).data.state.snapshot.sessions.length,
    0,
  );
  const rotated = await b.call("login", "POST", creds);
  assert.equal(rotated.data.state.snapshot.sessions.length, 1);
  const newSid = b.cookies.get("lab_session")!;
  assert.notEqual(newSid, sid);
  b.cookies.set("lab_session", sid);
  assert.equal((await b.call("profile")).response.status, 401);
  b.cookies.set("lab_session", newSid);
  await b.call("lab/expire", "POST");
  assert.equal(b.cookies.get("lab_session"), newSid);
  const expired = await b.call("profile");
  assert.equal(expired.response.status, 401);
  assert.equal(expired.data.state.sessionStatus, "期限切れ");
  await b.call("login", "POST", { ...creds, email: "admin@example.com" });
  assert.equal((await b.call("admin")).response.status, 200);
  const last = b.cookies.get("lab_session")!;
  const logout = await b.call("logout", "POST");
  assert.ok(logout.response.headers.get("set-cookie")?.includes("Max-Age=0"));
  assert.equal(logout.data.state.snapshot.sessions.length, 0);
  assert.equal(b.cookies.has("lab_session"), false);
  b.cookies.set("lab_session", last);
  assert.equal((await b.call("profile")).response.status, 401);
  const reset = await b.call("lab/reset", "POST");
  assert.equal(reset.data.state.snapshot.users.length, 2);
  assert.equal(reset.data.state.snapshot.sessions.length, 0);
});
test("mutating requests reject cross-origin and invalid payloads", async () => {
  const b = new Browser();
  await b.call("lab/init", "POST");
  assert.equal(
    (await b.call("login", "POST", creds, { Origin: "https://evil.example" }))
      .response.status,
    403,
  );
  assert.equal(
    (await b.call("login", "POST", creds, { "X-Lab-Request": "0" })).response
      .status,
    403,
  );
  assert.equal(
    (await b.call("login", "POST", creds, { "Content-Type": "text/plain" }))
      .response.status,
    403,
  );
  assert.equal(
    (await b.call("login", "POST", { ...creds, ttl: 0 })).response.status,
    400,
  );
  assert.equal(
    (await b.call("login", "POST", { ...creds, password: "あ".repeat(25) }))
      .response.status,
    400,
  );
  assert.equal((await b.call("login")).response.status, 405);
  assert.equal((await b.call("not-real")).response.status, 404);
});
