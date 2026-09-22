import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { decodeJwt } from 'jose';
import type { User } from './types';
import type { TokenPair, TokensCode, TokensSnapshot, RefreshFamily, RefreshRow } from './tokens-types';

// Opaque, high-entropy secrets, not passwords. Use Node's standard SHA-256 implementation.
export const refreshHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newRefreshToken = () => `rt_${randomBytes(32).toString('hex')}`;
export const isRefreshToken = (token: unknown): token is string => typeof token === 'string' && /^rt_[a-f0-9]{64}$/.test(token);
export const REFRESH_TTL = 1800;
type SignAccess = (user: User, ttl: 15 | 300) => Promise<string>;
type Outcome = { code: TokensCode; pair?: TokenPair; familyId?: string; before: TokensSnapshot; after: TokensSnapshot };
const plain = <T>(v: unknown): T => JSON.parse(JSON.stringify(v)) as T;

export async function refreshSnapshot(tx: Pick<Transaction, 'query'>, lab: string): Promise<TokensSnapshot> {
  const families = await tx.query('SELECT id,user_id,expires_at,created_at,revoked_at,revoke_reason FROM refresh_families WHERE lab_id=$1 ORDER BY created_at,id', [lab]);
  const tokens = await tx.query('SELECT id,family_id,user_id,token_hash,generation,expires_at,used_at,revoked_at,created_at FROM refresh_tokens WHERE lab_id=$1 AND family_id IS NOT NULL ORDER BY created_at,generation,id', [lab]);
  return plain<TokensSnapshot>({ families: families.rows, tokens: tokens.rows, capturedAt: new Date().toISOString() });
}

async function insertPair(tx: Transaction, lab: string, user: User, family: RefreshFamily, generation: number, ttl: 15 | 300, sign: SignAccess): Promise<TokenPair> {
  // Signing stays inside the transaction: a failed signature must not consume a Refresh Token.
  const accessToken = await sign(user, ttl);
  const refreshToken = newRefreshToken(), refreshId = randomUUID();
  await tx.query('INSERT INTO refresh_tokens(id,lab_id,user_id,token_hash,expires_at,family_id,generation) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [refreshId, lab, user.id, refreshHash(refreshToken), family.expires_at, family.id, generation]);
  return { accessToken, refreshToken, refreshId, familyId: family.id, generation,
    accessExpiresAt: new Date(decodeJwt(accessToken).exp! * 1000).toISOString(), refreshExpiresAt: family.expires_at };
}

async function revoke(tx: Transaction, lab: string, familyId: string, reason: string) {
  await tx.query('UPDATE refresh_families SET revoked_at=COALESCE(revoked_at,now()),revoke_reason=COALESCE(revoke_reason,$3) WHERE lab_id=$1 AND id=$2', [lab, familyId, reason]);
  await tx.query('UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE lab_id=$1 AND family_id=$2', [lab, familyId]);
}

export async function issueTokens(db: PGlite, lab: string, user: User, ttl: 15 | 300, sign: SignAccess): Promise<Outcome> {
  return db.transaction(async tx => {
    const before = await refreshSnapshot(tx, lab);
    const active = await tx.query<User>('SELECT * FROM users WHERE lab_id=$1 AND id=$2 AND status=\'active\'', [lab, user.id]);
    if (!active.rows[0]) return { code: 'inactive', before, after: await refreshSnapshot(tx, lab) };
    const created = await tx.query('INSERT INTO refresh_families(id,lab_id,user_id,expires_at) VALUES($1,$2,$3,now()+($4 * interval \'1 second\')) RETURNING id,user_id,expires_at,created_at,revoked_at,revoke_reason', [randomUUID(), lab, user.id, REFRESH_TTL]);
    const family = plain<RefreshFamily>(created.rows[0]);
    const pair = await insertPair(tx, lab, active.rows[0], family, 1, ttl, sign);
    return { code: 'valid', pair, familyId: family.id, before, after: await refreshSnapshot(tx, lab) };
  });
}

export async function useRefresh(db: PGlite, lab: string, token: string, operation: 'refresh' | 'revoke' | 'expire', sign: SignAccess): Promise<Outcome> {
  return db.transaction(async tx => {
    const before = await refreshSnapshot(tx, lab);
    const finish = async (code: TokensCode, familyId?: string, pair?: TokenPair): Promise<Outcome> => ({ code, familyId, pair, before, after: await refreshSnapshot(tx, lab) });
    if (!isRefreshToken(token)) return finish('invalid_refresh');
    const found = await tx.query<RefreshRow>('SELECT * FROM refresh_tokens WHERE lab_id=$1 AND token_hash=$2 AND family_id IS NOT NULL', [lab, refreshHash(token)]);
    const row = found.rows[0];
    if (!row) return finish('invalid_refresh');
    // PGlite serializes transactions; the family lock also documents the atomic rotation boundary.
    const families = await tx.query('SELECT * FROM refresh_families WHERE lab_id=$1 AND id=$2 FOR UPDATE', [lab, row.family_id]);
    const family = plain<RefreshFamily | undefined>(families.rows[0] ?? null);
    if (!family) return finish('invalid_refresh');
    if (operation === 'revoke') { await revoke(tx, lab, family.id, 'manual'); return finish('revoked_now', family.id); }
    if (operation === 'expire') {
      await tx.query('UPDATE refresh_families SET expires_at=now()-interval \'1 second\' WHERE lab_id=$1 AND id=$2', [lab, family.id]);
      await tx.query('UPDATE refresh_tokens SET expires_at=now()-interval \'1 second\' WHERE lab_id=$1 AND family_id=$2', [lab, family.id]);
      return finish('expired_now', family.id);
    }
    if (family.revoked_at || row.revoked_at) return finish('revoked', family.id);
    if (row.used_at) { await revoke(tx, lab, family.id, 'reuse'); return finish('reused', family.id); }
    if (new Date(family.expires_at).getTime() <= Date.now() || new Date(row.expires_at).getTime() <= Date.now()) return finish('refresh_expired', family.id);
    const users = await tx.query<User>('SELECT * FROM users WHERE lab_id=$1 AND id=$2', [lab, row.user_id]);
    const user = users.rows[0];
    if (!user || user.status !== 'active') { await revoke(tx, lab, family.id, 'inactive'); return finish('inactive', family.id); }
    await tx.query('UPDATE refresh_tokens SET used_at=now() WHERE lab_id=$1 AND id=$2', [lab, row.id]);
    const pair = await insertPair(tx, lab, user, family, row.generation + 1, 300, sign);
    return finish('valid', family.id, pair);
  });
}
