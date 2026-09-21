import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, decodeJwt } from 'jose';
import { issueJwt, verifyJwt, JWT_ISSUER, JWT_AUDIENCE, JWT_TYPE, spaceClaim } from '../src/lib/jwt';
import { changeJwt, readJwt, confirmsJwtLesson, type JwtObservation } from '../src/lib/jwt-learning';
import { jwtKeys } from '../src/lib/jwt-keys';
import { mkdtemp, stat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pair = generateKeyPair('RS256', { modulusLength: 2048 });
const user = { id: 'user-1', email: 'sample@example.com', role: 'user' as const };

test('JWT can be decoded without keys, but only a valid signature and claims authorize it', async () => {
  const keys = await pair;
  const token = await issueJwt(user, 'space-a', 300, keys.privateKey, 'test-key');
  const decoded = readJwt(token);
  assert.equal(decoded.header.alg, 'RS256');
  assert.equal(decoded.payload.email, user.email);
  assert.equal(decoded.payload.exp! - decoded.payload.iat!, 300);
  assert.equal((await verifyJwt(token, 'space-a', keys.publicKey)).code, 'valid');
  assert.equal((await verifyJwt(token, 'space-b', keys.publicKey)).code, 'space');
  assert.equal((await verifyJwt(null, 'space-a', keys.publicKey)).code, 'missing');
  assert.equal((await verifyJwt('not-a-token', 'space-a', keys.publicKey)).code, 'malformed');
});

test('role or expiry edits preserve the old signature and are rejected; alg none is rejected', async () => {
  const keys = await pair;
  const token = await issueJwt(user, 'space-a', 300, keys.privateKey, 'test-key');
  const modified = changeJwt(token, 'tamper');
  assert.equal(decodeJwt(modified).role, 'admin');
  assert.equal(modified.split('.')[2], token.split('.')[2]);
  assert.equal((await verifyJwt(modified, 'space-a', keys.publicKey)).code, 'signature');
  const expiryEdit = `${token.split('.')[0]}.${Buffer.from(JSON.stringify({ ...decodeJwt(token), exp: 9999999999 })).toString('base64url')}.${token.split('.')[2]}`;
  assert.equal((await verifyJwt(expiryEdit, 'space-a', keys.publicKey)).code, 'signature');
  assert.equal((await verifyJwt(changeJwt(token, 'none'), 'space-a', keys.publicKey)).code, 'algorithm');
});

test('the same unchanged JWT is accepted before exp and rejected exactly at exp', async () => {
  const keys = await pair;
  const token = await issueJwt(user, 'space-a', 15, keys.privateKey, 'test-key');
  const { exp } = decodeJwt(token);
  assert.equal((await verifyJwt(token, 'space-a', keys.publicKey, new Date(exp! * 1000 - 1))).code, 'valid');
  assert.equal((await verifyJwt(token, 'space-a', keys.publicKey, new Date(exp! * 1000))).code, 'expired');
});

test('valid signatures still require issuer, audience, type, claims and suitable lifetimes', async () => {
  const keys = await pair;
  const now = Math.floor(Date.now() / 1000);
  const base = { iss: JWT_ISSUER, aud: JWT_AUDIENCE, sub: user.id, email: user.email, role: user.role, lab: spaceClaim('space-a'), iat: now, exp: now + 300, jti: 'token-id' };
  for (const [patch, expected] of [
    [{ iss: 'other-issuer' }, 'issuer'], [{ aud: 'other-api' }, 'audience'],
    [{ exp: undefined }, 'claims'], [{ sub: undefined }, 'claims'], [{ role: 'owner' }, 'claims'],
    [{ iat: now + 100 }, 'claims'], [{ exp: now + 301 }, 'claims'],
  ] as const) {
    const token = await new SignJWT({ ...base, ...patch }).setProtectedHeader({ alg: 'RS256', typ: JWT_TYPE }).sign(keys.privateKey);
    assert.equal((await verifyJwt(token, 'space-a', keys.publicKey)).code, expected);
  }
  const token = await new SignJWT(base).setProtectedHeader({ alg: 'RS256', typ: 'other-token' }).sign(keys.privateKey);
  assert.equal((await verifyJwt(token, 'space-a', keys.publicKey)).code, 'claims');
});

test('a different signing key cannot authenticate a token, even with the expected kid', async () => {
  const keys = await pair;
  const other = await generateKeyPair('RS256', { modulusLength: 2048 });
  const token = await issueJwt(user, 'space-a', 300, other.privateKey, 'test-key');
  assert.equal((await verifyJwt(token, 'space-a', keys.publicKey)).code, 'signature');
});

test('persisted signing keys have restricted permissions and only public fields leave the key store', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jwt-keys-test-'));
  const old = process.env.LAB_DATA_DIR;
  process.env.LAB_DATA_DIR = directory;
  try {
    const keys = await jwtKeys();
    const again = await jwtKeys();
    assert.equal(keys.kid, again.kid);
    assert.equal((await stat(join(directory, 'jwt-signing-key.json'))).mode & 0o777, 0o600);
    assert.equal('d' in keys.publicJwk, false);
    const saved = JSON.parse(await readFile(join(directory, 'jwt-signing-key.json'), 'utf8'));
    assert.ok(saved.privateKey.d);
    const token = await issueJwt(user, 'space-a', 300, keys.privateKey, keys.kid);
    assert.equal((await verifyJwt(token, 'space-a', again.publicKey)).code, 'valid');
  } finally {
    if (old === undefined) delete process.env.LAB_DATA_DIR; else process.env.LAB_DATA_DIR = old;
    await rm(directory, { recursive: true, force: true });
  }
});

test('lesson completion requires the right rejection and the exact token, not just HTTP 401', async () => {
  const keys = await pair;
  const token = await issueJwt(user, 'space-a', 300, keys.privateKey, 'test-key');
  const previous = { afterToken: token } as JwtObservation;
  const o = { action: 'tamper', beforeToken: token, afterToken: token, sentToken: changeJwt(token, 'tamper'), steps: [], result: { status: 401, code: 'signature', before: { sessions: [] }, after: { sessions: [] } } } as unknown as JwtObservation;
  assert.equal(confirmsJwtLesson('tamper', o, previous), true);
  assert.equal(confirmsJwtLesson('tamper', { ...o, sentToken: null }, previous), false);
  assert.equal(confirmsJwtLesson('tamper', { ...o, result: { ...o.result!, code: 'expired' } }, previous), false);
  assert.equal(confirmsJwtLesson('tamper', { ...o, result: undefined }, previous), false);
  assert.equal(confirmsJwtLesson('tamper', o, { afterToken: 'different' } as JwtObservation), false);
});
