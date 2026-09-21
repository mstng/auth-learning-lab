import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair } from 'jose';
import { issueJwt } from '../src/lib/jwt';
import { confirmsComparison } from '../src/lib/compare-learning';
import type { CompareObservation } from '../src/lib/compare-types';
import type { LabState, Result, Snapshot } from '../src/lib/types';

async function evidence() {
  const key = await generateKeyPair('RS256');
  const user = { id: 'sample-id', email: 'sample@example.com', role: 'user' as const, status: 'active', created_at: new Date().toISOString() };
  const token = await issueJwt(user, 'lab', 300, key.privateKey, 'kid');
  const pair = { sessionId: 'a'.repeat(64), jwt: token };
  const snapshot: Snapshot = { users: [{ ...user, password_hash: 'test-hash' }], sessions: [], refresh_tokens: [], oauth_clients: [], authorization_codes: [] };
  const loggedOut: LabState = { snapshot, authenticated: false, user: null, cookie: null, sessionStatus: 'Cookieなし', sessionExpires: null, serverTime: new Date().toISOString(), transport: 'HTTP' };
  const loggedIn: LabState = { ...loggedOut, authenticated: true, user, cookie: { name: 'lab_session', value: pair.sessionId, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax', expires: null, source: 'test' }, snapshot: { ...snapshot, sessions: [{ id: pair.sessionId, user_id: user.id, expires_at: new Date(Date.now() + 300000).toISOString(), created_at: new Date().toISOString() }] } };
  const session: Result = { success: true, message: '', trace: [], requestId: 's', state: loggedIn, http: { method: 'GET', path: '/api/profile', requestHeaders: { Cookie: `lab_session=${pair.sessionId}` }, responseHeaders: {}, responseBody: {}, status: 200 } };
  const memory = { activeJwt: token, copy: pair };
  const heldCopy = { activeJwt: null, copy: pair };
  const jwt = { status: 200, code: 'valid', token, claims: { sub: user.id }, before: loggedIn.snapshot, after: loggedIn.snapshot, http: { requestHeaders: { Authorization: `Bearer ${token}` } } };
  const prepare = { id: '1', action: 'prepare', before: loggedOut, after: loggedIn, memoryBefore: { activeJwt: null, copy: null }, memoryAfter: memory, session, jwt, steps: [] } as unknown as CompareObservation;
  const access = { ...prepare, id: '2', action: 'access', before: loggedIn, memoryBefore: memory } as CompareObservation;
  const logout = { ...access, id: '3', action: 'logout', after: loggedOut, memoryAfter: heldCopy, jwt: undefined, session: { ...session, state: loggedOut } } as CompareObservation;
  const replay = { ...logout, id: '4', action: 'replay', before: loggedOut, memoryBefore: heldCopy, session: undefined, jwt: { ...jwt, before: snapshot, after: snapshot }, replay: { status: 401, code: 'missing', receivedVia: 'json-body', sessionId: pair.sessionId, before: snapshot, after: snapshot, http: { requestBody: { sessionId: pair.sessionId } } } } as unknown as CompareObservation;
  return { prepare, access, logout, replay };
}

test('comparison evidence accepts only the continuous issuance, access, logout and replay sequence', async () => {
  const { prepare, access, logout, replay } = await evidence();
  assert.equal(confirmsComparison(prepare), true);
  assert.equal(confirmsComparison(access, prepare), true);
  assert.equal(confirmsComparison(logout, access), true);
  assert.equal(confirmsComparison(replay, logout), true);
  assert.equal(confirmsComparison(replay, access), false);
});

test('comparison cannot substitute another Session ID, JWT or Bearer header', async () => {
  const { logout, replay } = await evidence();
  const modified = structuredClone(replay);
  modified.memoryAfter.copy!.sessionId = 'b'.repeat(64);
  assert.equal(confirmsComparison(modified, logout), false);
  const header = structuredClone(replay);
  header.jwt!.http.requestHeaders.Authorization = 'Bearer different';
  assert.equal(confirmsComparison(header, logout), false);
  const body = structuredClone(replay);
  body.replay!.http.requestBody = { sessionId: 'b'.repeat(64) };
  assert.equal(confirmsComparison(body, logout), false);
});

test('JWT expiry or an expired Session row does not prove the logout replay contrast', async () => {
  const { logout, replay } = await evidence();
  const expiredJwt = structuredClone(replay); expiredJwt.jwt!.status = 401; expiredJwt.jwt!.code = 'expired';
  assert.equal(confirmsComparison(expiredJwt, logout), false);
  const expiredSession = structuredClone(replay); expiredSession.replay!.code = 'expired';
  assert.equal(confirmsComparison(expiredSession, logout), false);
  const rowRemains = structuredClone(replay); rowRemains.after.snapshot.sessions = logout.before.snapshot.sessions;
  assert.equal(confirmsComparison(rowRemains, logout), false);
});

test('missing observations and mismatched Cookie state never mark the comparison complete', async () => {
  const { prepare, access, logout, replay } = await evidence();
  assert.equal(confirmsComparison({ ...replay, after: null } as unknown as CompareObservation, logout), false);
  assert.equal(confirmsComparison({ ...access, after: { ...access.after, cookie: null } }, prepare), false);
  assert.equal(confirmsComparison({ ...logout, after: logout.before }, access), false);
  assert.equal(confirmsComparison({ ...prepare, memoryAfter: { activeJwt: 'broken', copy: { sessionId: 'a', jwt: 'broken' } } }), false);
});
