import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
const origin = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
class Client {
  jar = new Map<string, string>();
  async call(path: string, method = 'GET', body?: unknown, token?: string) {
    const r = await fetch(`${origin}/api/${path}`, { method, headers: { 'X-Lab-Request': '1', 'Content-Type': 'application/json', Origin: origin, Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of r.headers.getSetCookie()) { const pair = cookie.split(';')[0], i = pair.indexOf('='); this.jar.set(pair.slice(0, i), pair.slice(i + 1)); }
    return { r, data: await r.json() };
  }
}
const credentials = { email: 'sample@example.com', password: 'LearnSession!2026', ttl: 300 };
async function client() { const c = new Client(); await c.call('lab/init', 'POST', {}); return c; }
const issue = (c: Client, ttl = 300) => c.call('tokens/issue', 'POST', { ...credentials, ttl });
const refresh = (c: Client, refreshToken: string) => c.call('tokens/refresh', 'POST', { refreshToken });
const profile = (c: Client, token: string) => c.call('tokens/profile', 'GET', undefined, token);

test('real time expiry, renewal, replay detection and already-issued Access behavior', async () => {
  const c = await client(); await c.call('login', 'POST', credentials);
  const sid = c.jar.get('lab_session'), beforeSession = (await c.call('lab/state')).data.state.snapshot.sessions;
  const first = await issue(c, 15), a = first.data.pair;
  assert.equal(first.r.status, 200); assert.equal(first.r.headers.getSetCookie().length, 0);
  assert.equal((await profile(c, a.accessToken)).r.status, 200);
  const wrong = await profile(c, a.refreshToken); assert.equal(wrong.r.status, 401); assert.equal(wrong.data.code, 'malformed');
  await delay(Math.max(0, Date.parse(a.accessExpiresAt) - Date.now()) + 150);
  const expired = await profile(c, a.accessToken); assert.equal(expired.r.status, 401); assert.equal(expired.data.code, 'expired');
  const update = await refresh(c, a.refreshToken), b = update.data.pair;
  assert.equal(update.r.status, 200); assert.notEqual(a.accessToken, b.accessToken); assert.notEqual(a.refreshToken, b.refreshToken);
  assert.equal(a.refreshExpiresAt, b.refreshExpiresAt); assert.equal(b.generation, 2);
  assert.equal(update.data.http.requestBody.password, undefined);
  assert.equal((await profile(c, b.accessToken)).r.status, 200);
  const reused = await refresh(c, a.refreshToken); assert.equal(reused.r.status, 401); assert.equal(reused.data.code, 'reused');
  assert.equal(reused.data.http.requestBody.refreshToken, a.refreshToken);
  assert.ok(reused.data.after.tokens.every((t: { revoked_at: string }) => t.revoked_at));
  assert.equal((await refresh(c, b.refreshToken)).data.code, 'revoked');
  const still = await profile(c, b.accessToken); assert.equal(still.r.status, 200); assert.equal(still.data.http.requestHeaders.Authorization, `Bearer ${b.accessToken}`);
  assert.equal(c.jar.get('lab_session'), sid);
  const snap = (await c.call('lab/state')).data.state.snapshot;
  assert.deepEqual(snap.sessions, beforeSession); assert.equal(snap.refresh_tokens.length, 2);
  const stored = JSON.stringify(snap.refresh_tokens);
  assert.equal(stored.includes(a.refreshToken), false); assert.equal(stored.includes(b.accessToken), false);
  assert.equal(snap.refresh_tokens[0].token_hash, createHash('sha256').update(a.refreshToken).digest('hex'));
});

test('parallel HTTP refresh rotates once, then stops the family; unrelated families keep working', async () => {
  const c = await client(); const a = (await issue(c)).data.pair, other = (await issue(c)).data.pair;
  const replies = await Promise.all([refresh(c, a.refreshToken), refresh(c, a.refreshToken)]);
  assert.deepEqual(replies.map(r => r.data.code).sort(), ['reused', 'valid']);
  const b = replies.find(r => r.r.status === 200)!.data.pair;
  assert.equal((await refresh(c, b.refreshToken)).data.code, 'revoked');
  assert.equal((await refresh(c, other.refreshToken)).r.status, 200);
});

test('manual revocation and DB Refresh expiry prevent renewal, not already-issued Access', async () => {
  const c = await client();
  for (const [operation, code] of [['revoke', 'revoked'], ['expire', 'refresh_expired']]) {
    const a = (await issue(c)).data.pair;
    const r = await c.call(`tokens/${operation}`, 'POST', { refreshToken: a.refreshToken }); assert.equal(r.r.status, 200);
    assert.equal((await refresh(c, a.refreshToken)).data.code, code);
    assert.equal((await profile(c, a.accessToken)).r.status, 200);
  }
});

test('lab isolation and wrong credentials never issue or revoke someone else’s tokens', async () => {
  const c = await client(), other = await client(); const a = (await issue(c)).data.pair;
  assert.equal((await c.call('tokens/issue', 'POST', { ...credentials, password: 'wrong' })).r.status, 401);
  assert.equal((await refresh(c, a.accessToken)).data.code, 'invalid_refresh');
  assert.equal((await refresh(other, a.refreshToken)).data.code, 'invalid_refresh');
  const revoke = await other.call('tokens/revoke', 'POST', { refreshToken: a.refreshToken });
  assert.equal(revoke.r.status, 401); assert.equal(revoke.data.familyId, undefined); assert.equal(revoke.data.after.families.length, 0);
  assert.equal((await profile(other, a.accessToken)).data.code, 'space');
  assert.equal((await refresh(c, a.refreshToken)).r.status, 200);
});

test('tokens API preserves guard, bounded input, initialization and HTTP method checks', async () => {
  const c = new Client(); assert.equal((await issue(c)).r.status, 428);
  await c.call('lab/init', 'POST', {});
  assert.equal((await c.call('tokens/issue')).r.status, 405);
  assert.equal((await c.call('tokens/unknown')).r.status, 404);
  assert.equal((await c.call('tokens/issue', 'POST', { ...credentials, ttl: 99999 })).r.status, 400);
  assert.equal((await c.call('tokens/refresh', 'POST', null)).r.status, 400);
  assert.equal((await refresh(c, 'a'.repeat(11000))).r.status, 413);
  const denied = await fetch(`${origin}/api/tokens/refresh`, { method: 'POST', headers: { 'X-Lab-Request': '1', 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: '{}' }); assert.equal(denied.status, 403);
  assert.equal((await fetch(`${origin}/api/tokens/state`)).status, 403);
  const state = await c.call('tokens/state'); assert.equal(state.r.status, 200); assert.match(state.r.headers.get('cache-control')!, /no-store/);
});
