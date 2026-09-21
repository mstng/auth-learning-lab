import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt } from 'jose';
import { changeJwt } from '../src/lib/jwt-learning';
const origin = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
class Client {
  jar = new Map<string, string>();
  async call(path: string, method = 'GET', body: unknown = {}, token?: string) {
    const r = await fetch(`${origin}/api/${path}`, { method, headers: {
      'X-Lab-Request': '1', 'Content-Type': 'application/json', Origin: origin,
      Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
    for (const c of r.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)); }
    return { r, data: await r.json() };
  }
}
const credentials = { email: 'sample@example.com', password: 'LearnSession!2026', ttl: 300 };

test('JWT APIs use real password, signature and claims checks without changing an existing Session', async () => {
  const c = new Client();
  assert.equal((await c.call('jwt/issue', 'POST', credentials)).r.status, 428);
  await c.call('lab/init', 'POST');
  const session = await c.call('login', 'POST', credentials);
  const sid = c.jar.get('lab_session');
  const wrong = await c.call('jwt/issue', 'POST', { ...credentials, password: 'wrong-password' });
  assert.equal(wrong.data.code, 'credentials'); assert.equal(wrong.data.token, undefined);
  const issue = await c.call('jwt/issue', 'POST', credentials);
  assert.equal(issue.r.status, 200);
  assert.equal(issue.r.headers.getSetCookie().length, 0);
  assert.equal(issue.data.after.sessions[0].id, sid);
  assert.deepEqual(issue.data.before.sessions, issue.data.after.sessions);
  assert.equal('d' in issue.data.publicKey, false);
  assert.equal(JSON.stringify(issue.data).includes(credentials.password), false);
  assert.equal(decodeJwt(issue.data.token).sub, session.data.state.user.id);
  const valid = await c.call('jwt/profile', 'GET', {}, issue.data.token);
  assert.equal(valid.r.status, 200); assert.equal(valid.data.claims.role, 'user');
  assert.equal(valid.data.http.requestHeaders.Authorization, `Bearer ${issue.data.token}`);
  assert.equal((await c.call('jwt/profile')).data.code, 'missing');
  assert.equal((await c.call('jwt/profile', 'GET', {}, changeJwt(issue.data.token, 'tamper'))).data.code, 'signature');
  assert.equal((await c.call('jwt/profile', 'GET', {}, changeJwt(issue.data.token, 'none'))).data.code, 'algorithm');
  assert.equal((await c.call('jwt/profile', 'GET', {}, 'dummy.token.value')).r.status, 401);
  const other = new Client(); await other.call('lab/init', 'POST');
  assert.equal((await other.call('jwt/profile', 'GET', {}, issue.data.token)).data.code, 'space');
  assert.equal((await c.call('profile')).r.status, 200);
  assert.equal(c.jar.get('lab_session'), sid);
  assert.deepEqual((await c.call('lab/state')).data.state.snapshot.sessions, session.data.state.snapshot.sessions);
});

test('JWT routes enforce local guards, methods, JSON and TTL limits', async () => {
  const c = new Client(); await c.call('lab/init', 'POST');
  assert.equal((await c.call('jwt/issue')).r.status, 405);
  assert.equal((await c.call('jwt/unknown')).r.status, 404);
  assert.equal((await c.call('jwt/issue', 'POST', { ...credentials, ttl: 99999 })).r.status, 400);
  const denied = await fetch(`${origin}/api/jwt/issue`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example', 'X-Lab-Request': '1' }, body: '{}' });
  assert.equal(denied.status, 403);
  assert.equal((await fetch(`${origin}/api/jwt/profile`)).status, 403);
});

test('a short-lived real token is accepted before expiry and rejected after natural elapsed time', async () => {
  const c = new Client(); await c.call('lab/init', 'POST');
  const issue = await c.call('jwt/issue', 'POST', { ...credentials, ttl: 15 });
  const token = issue.data.token;
  assert.equal((await c.call('jwt/profile', 'GET', {}, token)).r.status, 200);
  const exp = decodeJwt(token).exp!;
  await new Promise(resolve => setTimeout(resolve, Math.max(0, exp * 1000 - Date.now()) + 100));
  const expired = await c.call('jwt/profile', 'GET', {}, token);
  assert.equal(expired.r.status, 401); assert.equal(expired.data.code, 'expired');
  assert.equal(expired.data.http.requestHeaders.Authorization, `Bearer ${token}`);
});
