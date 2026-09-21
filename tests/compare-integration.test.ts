import test from 'node:test';
import assert from 'node:assert/strict';
const origin = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
class Client {
  jar = new Map<string, string>();
  async call(path: string, method = 'GET', body?: unknown, token?: string) {
    const r = await fetch(`${origin}/api/${path}`, { method, headers: {
      'X-Lab-Request': '1', 'Content-Type': 'application/json', Origin: origin,
      Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of r.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const i = pair.indexOf('='); this.jar.set(pair.slice(0, i), pair.slice(i + 1)); }
    return { r, data: await r.json() };
  }
}
const credentials = { email: 'sample@example.com', password: 'LearnSession!2026', ttl: 300 };
const replay = (c: Client, sessionId: string) => c.call('compare/session-replay', 'POST', { sessionId });

test('actual logout rejects both JSON and Cookie replay of the old Session, while the same JWT still works', async () => {
  const c = new Client(); await c.call('lab/init', 'POST', {});
  const login = await c.call('login', 'POST', credentials);
  const sid = c.jar.get('lab_session')!;
  const issued = await c.call('jwt/issue', 'POST', credentials);
  const token = issued.data.token;
  const active = await replay(c, sid);
  assert.equal(active.r.status, 200); assert.equal(active.data.profile.id, login.data.state.user.id);
  assert.equal(active.r.headers.getSetCookie().length, 0);
  assert.equal((await c.call('profile')).r.status, 200);
  assert.equal((await c.call('jwt/profile', 'GET', undefined, token)).r.status, 200);
  await c.call('logout', 'POST', {});
  const stopped = await replay(c, sid);
  assert.equal(stopped.r.status, 401); assert.equal(stopped.data.code, 'missing');
  assert.equal(stopped.data.sessionId, sid); assert.equal(stopped.data.receivedVia, 'json-body');
  assert.equal(stopped.data.http.requestBody.sessionId, sid);
  assert.equal(stopped.data.before.sessions.length, 0); assert.deepEqual(stopped.data.before, stopped.data.after);
  const stillValid = await c.call('jwt/profile', 'GET', undefined, token);
  assert.equal(stillValid.r.status, 200); assert.equal(stillValid.data.code, 'valid');
  assert.equal(stillValid.data.http.requestHeaders.Authorization, `Bearer ${token}`);
  const cookieReplay = new Client(); cookieReplay.jar = new Map(c.jar); cookieReplay.jar.set('lab_session', sid);
  const actual = await cookieReplay.call('profile');
  assert.equal(actual.r.status, 401); assert.equal(actual.data.state.sessionStatus, 'Sessionレコードなし');
  assert.equal((await c.call('lab/state')).data.state.cookie, null);
});

test('Session replay respects expiry, lab isolation, and JSON identity rather than an unrelated current Cookie', async () => {
  const c = new Client(); await c.call('lab/init', 'POST', {}); await c.call('login', 'POST', credentials);
  const sid = c.jar.get('lab_session')!;
  const other = new Client(); await other.call('lab/init', 'POST', {});
  assert.equal((await replay(other, sid)).data.code, 'missing');
  await c.call('lab/expire', 'POST', {});
  assert.equal((await replay(c, sid)).data.code, 'expired');
  await c.call('login', 'POST', credentials);
  assert.notEqual(c.jar.get('lab_session'), sid);
  assert.equal((await c.call('profile')).r.status, 200);
  assert.equal((await replay(c, sid)).data.code, 'missing');
  assert.equal((await replay(c, c.jar.get('lab_session')!)).data.code, 'valid');
});

test('Session replay enforces same-origin, initialization, methods and bounded input', async () => {
  const c = new Client();
  assert.equal((await replay(c, 'a'.repeat(64))).r.status, 428);
  await c.call('lab/init', 'POST', {});
  assert.equal((await c.call('compare/session-replay')).r.status, 405);
  assert.equal((await replay(c, "' OR 1=1 --")).r.status, 400);
  assert.equal((await replay(c, 'a'.repeat(1100))).r.status, 413);
  const denied = await fetch(`${origin}/api/compare/session-replay`, { method: 'POST', headers: { 'X-Lab-Request': '1', 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: JSON.stringify({ sessionId: 'a'.repeat(64) }) });
  assert.equal(denied.status, 403);
  assert.equal((await fetch(`${origin}/api/compare/session-replay`, { method: 'POST' })).status, 403);
});
