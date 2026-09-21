import type { Snapshot, HttpRecord } from './types';

export type JwtCode = 'valid' | 'missing' | 'malformed' | 'signature' | 'expired' | 'algorithm' | 'issuer' | 'audience' | 'claims' | 'space' | 'credentials';
export type JwtStep = {
  id: string;
  at: string;
  place: 'browser' | 'server' | 'database';
  title: string;
  why: string;
  detail: string;
  evidence: 'server' | 'browser';
};
export type JwtClaims = {
  iss: string; aud: string; sub: string; iat: number; exp: number;
  jti: string; lab: string; email: string; role: 'user' | 'admin';
};
export type JwtResult = {
  requestId: string;
  status: number;
  code: JwtCode;
  message: string;
  token?: string;
  claims?: JwtClaims;
  publicKey: Record<string, unknown>;
  keyId: string;
  serverTime: string;
  before: Snapshot;
  after: Snapshot;
  trace: JwtStep[];
  http: HttpRecord;
};
export const jwtMessages: Record<JwtCode, string> = {
  valid: '署名と利用条件を確認できました。',
  missing: '送られたJWTがありません。',
  malformed: 'JWTの形式を読み取れません。',
  signature: '署名が一致しないため、利用を断りました。',
  expired: '有効期限を過ぎているため、利用を断りました。',
  algorithm: '許可したRS256以外の方式なので、利用を断りました。',
  issuer: '想定した発行者ではないため、利用を断りました。',
  audience: 'このAPI宛てではないため、利用を断りました。',
  claims: '必須の情報や値が正しくないため、利用を断りました。',
  space: '別の学習空間のJWTなので、利用を断りました。',
  credentials: 'メールアドレスまたはパスワードを確認できませんでした。',
};
