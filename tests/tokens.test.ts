import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { generateKeyPair } from 'jose';
import { issueTokens, useRefresh, refreshHash, refreshSnapshot, newRefreshToken } from '../src/lib/refresh-store';
import { issueJwt, verifyJwt } from '../src/lib/jwt';
import { confirmsTokens } from '../src/lib/tokens-learning';
import type { User } from '../src/lib/types';
import type { TokensObservation, TokensResult } from '../src/lib/tokens-types';

let db: PGlite;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let schema: string;
before(async () => { schema = await readFile('db/schema.sql', 'utf8'); db = await PGlite.create(); await db.exec(schema); keys = await generateKeyPair('RS256'); });
after(async () => { await db.close(); });
async function fixture() {
  const lab = randomUUID();
  await db.query('INSERT INTO lab_spaces(id) VALUES($1)', [lab]);
  const { rows } = await db.query<User>("INSERT INTO users(id,lab_id,email,password_hash,role) VALUES($1,$2,'test@example.com','test-hash','user') RETURNING *", [randomUUID(), lab]);
  const user = rows[0];
  const sign = (u: User, ttl: 15 | 300) => issueJwt(u, lab, ttl, keys.privateKey, 'test-key');
  return { lab, user, sign };
}

test('v1.8 schema upgrades twice without deleting users, sessions or reserved legacy rows', async () => {
  const old = await PGlite.create();
  try {
    await old.exec(schema.split('-- PHASE 9:')[0]);
    await old.exec("INSERT INTO lab_spaces(id) VALUES('keep'); INSERT INTO users(id,lab_id,email,password_hash,role) VALUES('u','keep','keep@example.com','keep-hash','user'); INSERT INTO sessions(id,lab_id,user_id,expires_at) VALUES('keep-session','keep','u',now()+interval '1 hour'); INSERT INTO refresh_tokens(id,lab_id,user_id,token_hash,expires_at) VALUES('legacy','keep','u','legacy-hash',now()+interval '1 hour')");
    await old.exec(schema); await old.exec(schema);
    assert.equal((await old.query<{ password_hash: string }>('SELECT password_hash FROM users')).rows[0].password_hash, 'keep-hash');
    assert.equal((await old.query('SELECT * FROM sessions')).rows.length, 1);
    assert.equal((await old.query('SELECT * FROM refresh_tokens')).rows.length, 1);
  } finally { await old.close(); }
});

test('rotation stores only hashes, retains used generations, and never extends the family expiry', async () => {
  const { lab, user, sign } = await fixture();
  const issued = await issueTokens(db, lab, user, 300, sign), a = issued.pair!;
  const rotated = await useRefresh(db, lab, a.refreshToken, 'refresh', sign), b = rotated.pair!;
  assert.equal(rotated.code, 'valid'); assert.equal(b.generation, 2); assert.equal(a.familyId, b.familyId);
  assert.notEqual(a.accessToken, b.accessToken); assert.notEqual(a.refreshToken, b.refreshToken);
  assert.equal(a.refreshExpiresAt, b.refreshExpiresAt);
  assert.equal(rotated.after.tokens[0].token_hash, refreshHash(a.refreshToken));
  assert.ok(rotated.after.tokens[0].used_at); assert.equal(rotated.after.tokens[1].used_at, null);
  const stored = JSON.stringify(rotated.after);
  for (const token of [a.accessToken, a.refreshToken, b.accessToken, b.refreshToken]) assert.equal(stored.includes(token), false);
  assert.equal((await verifyJwt(b.accessToken, lab, keys.publicKey)).code, 'valid');
});

test('concurrent refresh uses the token once, detects reuse, and revokes only that family', async () => {
  const { lab, user, sign } = await fixture();
  const a = (await issueTokens(db, lab, user, 300, sign)).pair!;
  const other = (await issueTokens(db, lab, user, 300, sign)).pair!;
  const results = await Promise.all([useRefresh(db, lab, a.refreshToken, 'refresh', sign), useRefresh(db, lab, a.refreshToken, 'refresh', sign)]);
  assert.deepEqual(results.map(r => r.code).sort(), ['reused', 'valid']);
  const b = results.find(r => r.pair)!.pair!;
  assert.equal((await useRefresh(db, lab, b.refreshToken, 'refresh', sign)).code, 'revoked');
  assert.equal((await useRefresh(db, lab, other.refreshToken, 'refresh', sign)).code, 'valid');
  const state = await refreshSnapshot(db, lab);
  assert.equal(state.tokens.filter(t => t.family_id === a.familyId).length, 2);
  assert.ok(state.tokens.filter(t => t.family_id === a.familyId).every(t => t.revoked_at));
  assert.equal((await verifyJwt(b.accessToken, lab, keys.publicKey)).code, 'valid');
});

test('failed signing rolls back rotation so a transient failure cannot consume a Refresh Token', async () => {
  const { lab, user, sign } = await fixture();
  const a = (await issueTokens(db, lab, user, 300, sign)).pair!;
  await assert.rejects(useRefresh(db, lab, a.refreshToken, 'refresh', async () => { throw new Error('key unavailable'); }));
  const state = await refreshSnapshot(db, lab);
  assert.equal(state.tokens.length, 1); assert.equal(state.tokens[0].used_at, null); assert.equal(state.families[0].revoked_at, null);
  assert.equal((await useRefresh(db, lab, a.refreshToken, 'refresh', sign)).code, 'valid');
});

test('unknown, wrong-kind and other-lab tokens cannot change or disclose a family', async () => {
  const { lab, user, sign } = await fixture(), other = await fixture();
  const a = (await issueTokens(db, lab, user, 300, sign)).pair!;
  for (const token of [newRefreshToken(), a.accessToken, "' OR 1=1 --"]) {
    const r = await useRefresh(db, lab, token, 'refresh', sign);
    assert.equal(r.code, 'invalid_refresh'); assert.deepEqual(r.before.tokens, r.after.tokens);
  }
  const r = await useRefresh(db, other.lab, a.refreshToken, 'revoke', other.sign);
  assert.equal(r.code, 'invalid_refresh'); assert.equal(r.familyId, undefined); assert.equal(r.after.families.length, 0);
  assert.equal((await useRefresh(db, lab, a.refreshToken, 'refresh', sign)).code, 'valid');
});

test('Refresh expiry and inactive users stop renewal without altering an existing Access JWT', async () => {
  const { lab, user, sign } = await fixture();
  const a = (await issueTokens(db, lab, user, 300, sign)).pair!;
  await useRefresh(db, lab, a.refreshToken, 'expire', sign);
  assert.equal((await useRefresh(db, lab, a.refreshToken, 'refresh', sign)).code, 'refresh_expired');
  assert.equal((await verifyJwt(a.accessToken, lab, keys.publicKey)).code, 'valid');
  const b = (await issueTokens(db, lab, user, 300, sign)).pair!;
  await db.query("UPDATE users SET status='disabled' WHERE lab_id=$1 AND id=$2", [lab, user.id]);
  assert.equal((await useRefresh(db, lab, b.refreshToken, 'refresh', sign)).code, 'inactive');
  assert.equal((await useRefresh(db, lab, b.refreshToken, 'refresh', sign)).code, 'revoked');
});

test('lesson evidence rejects another 401, substituted values and missing DB observations', async () => {
  const { lab, user, sign } = await fixture();
  const a = (await issueTokens(db, lab, user, 300, sign)).pair!;
  const state = await refreshSnapshot(db, lab), memory = { pair: a, oldRefresh: null };
  const result: TokensResult = { requestId: 'r', operation: 'profile', status: 401, code: 'malformed', message: '', before: state, after: state, serverTime: new Date().toISOString(), trace: [], http: { method: 'GET', path: '/api/tokens/profile', status: 401, requestHeaders: { Authorization: `Bearer ${a.refreshToken}` }, responseHeaders: {}, responseBody: {} } };
  const previous = { after: memory } as TokensObservation;
  const o: TokensObservation = { action: 'wrong-target', result, before: memory, after: memory };
  assert.equal(confirmsTokens(o, previous), true);
  assert.equal(confirmsTokens({ ...o, result: { ...result, code: 'expired' } }, previous), false);
  assert.equal(confirmsTokens({ ...o, result: { ...result, http: { ...result.http, requestHeaders: { Authorization: `Bearer ${a.accessToken}` } } } }, previous), false);
  assert.equal(confirmsTokens({ ...o, result: { ...result, after: undefined } } as unknown as TokensObservation, previous), false);
  assert.equal(confirmsTokens({ ...o, action: 'still-access' }, previous), false);
});
