import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  validCredentials,
} from "../src/lib/password";
import { isSessionValid } from "../src/lib/store";
test("bcrypt verifies only the correct password; random salt produces different hashes", async () => {
  const [a, b] = await Promise.all([
    hashPassword("test-password"),
    hashPassword("test-password"),
  ]);
  assert.notEqual(a, b);
  assert.ok(a.startsWith("$2"));
  assert.ok(await verifyPassword("test-password", a));
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(a.includes("test-password"), false);
});
test("bcrypt 72-byte limit and permitted TTLs are enforced before hashing", () => {
  assert.ok(
    validCredentials({ email: "sample@example.com", password: "x", ttl: 15 }),
  );
  assert.equal(
    validCredentials({ email: "x", password: "あ".repeat(25) }),
    false,
  );
  assert.equal(validCredentials({ email: "x", password: "", ttl: 300 }), false);
  assert.equal(
    validCredentials({ email: "x", password: "x", ttl: 99999 }),
    false,
  );
  assert.equal(validCredentials(null), false);
});
test("session expires at the exact boundary and missing sessions fail closed", () => {
  const s = {
    id: "x",
    user_id: "u",
    created_at: new Date(0).toISOString(),
    expires_at: new Date(1000).toISOString(),
  };
  assert.ok(isSessionValid(s, 999));
  assert.equal(isSessionValid(s, 1000), false);
  assert.equal(isSessionValid(s, 1001), false);
  assert.equal(isSessionValid(undefined), false);
});
