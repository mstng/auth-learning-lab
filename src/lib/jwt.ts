import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, errors, type KeyInput } from 'jose';
import type { JwtClaims, JwtCode } from './jwt-types';

export const JWT_ISSUER = 'urn:authentication-learning-lab:issuer';
export const JWT_AUDIENCE = 'urn:authentication-learning-lab:profile-api';
export const JWT_TYPE = 'authlab-access+jwt';
export const spaceClaim = (space: string) => createHash('sha256').update(space).digest('hex');

export async function issueJwt(user: { id: string; email: string; role: 'user' | 'admin' }, space: string, ttl: 15 | 300, key: KeyInput, kid: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: user.email, role: user.role, lab: spaceClaim(space) })
    .setProtectedHeader({ alg: 'RS256', typ: JWT_TYPE, kid })
    .setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE).setSubject(user.id)
    .setIssuedAt(now).setExpirationTime(now + ttl).setJti(randomUUID()).sign(key);
}

export async function verifyJwt(token: string | null, space: string, key: KeyInput, now = new Date()): Promise<{ code: JwtCode; claims?: JwtClaims; libraryCode?: string }> {
  if (!token) return { code: 'missing' };
  if (token.length > 8192) return { code: 'malformed' };
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      typ: JWT_TYPE, requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'jti', 'lab', 'email', 'role'],
      clockTolerance: 0, currentDate: now,
    });
    if (payload.lab !== spaceClaim(space)) return { code: 'space' };
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.jti !== 'string' || !payload.jti
      || typeof payload.email !== 'string' || (payload.role !== 'user' && payload.role !== 'admin')
      || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)
      || payload.iat! > Math.floor(now.getTime() / 1000) || payload.exp! <= payload.iat!
      || payload.exp! - payload.iat! > 300 || payload.aud !== JWT_AUDIENCE) return { code: 'claims' };
    return { code: 'valid', claims: payload as JwtClaims };
  } catch (error) {
    let code: JwtCode;
    if (error instanceof errors.JOSEAlgNotAllowed) code = 'algorithm';
    else if (error instanceof errors.JWSSignatureVerificationFailed) code = 'signature';
    else if (error instanceof errors.JWTExpired) code = 'expired';
    else if (error instanceof errors.JWTClaimValidationFailed) {
      code = error.claim === 'iss' ? 'issuer' : error.claim === 'aud' ? 'audience' : 'claims';
    } else if (error instanceof errors.JOSEError) code = 'malformed';
    else throw error;
    return { code, libraryCode: (error as errors.JOSEError).code };
  }
}
