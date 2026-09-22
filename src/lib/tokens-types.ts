import type { HttpRecord } from './types';
import type { JwtClaims, JwtCode, JwtStep } from './jwt-types';

export type RefreshFamily = {
  id: string; user_id: string; expires_at: string; created_at: string;
  revoked_at: string | null; revoke_reason: string | null;
};
export type RefreshRow = {
  id: string; family_id: string; user_id: string; token_hash: string;
  generation: number; expires_at: string; used_at: string | null;
  revoked_at: string | null; created_at: string;
};
export type TokensSnapshot = { families: RefreshFamily[]; tokens: RefreshRow[]; capturedAt: string };
export type TokenPair = {
  accessToken: string; refreshToken: string; refreshId: string; familyId: string;
  generation: number; accessExpiresAt: string; refreshExpiresAt: string;
};
export type TokensCode = JwtCode | 'invalid_refresh' | 'refresh_expired' | 'reused' | 'revoked' | 'inactive' | 'revoked_now' | 'expired_now';
export type TokensOperation = 'issue' | 'refresh' | 'profile' | 'revoke' | 'expire';
export type TokensResult = {
  requestId: string; operation: TokensOperation; status: number; code: TokensCode;
  message: string; pair?: TokenPair; claims?: JwtClaims; familyId?: string;
  before: TokensSnapshot; after: TokensSnapshot; serverTime: string;
  trace: JwtStep[]; http: HttpRecord;
};
export type TokensAction = 'issue' | 'wrong-target' | 'expired-access' | 'refresh' | 'profile' | 'reuse' | 'blocked-refresh' | 'still-access' | 'revoke' | 'expire';
export type TokensMemory = { pair: TokenPair | null; oldRefresh: string | null };
export type TokensObservation = { action: TokensAction; result: TokensResult; before: TokensMemory; after: TokensMemory };
export const emptyTokensMemory: TokensMemory = { pair: null, oldRefresh: null };

export const refreshMessages: Partial<Record<TokensCode, string>> = {
  invalid_refresh: 'この更新用トークンを確認できません。',
  refresh_expired: '更新できる期限を過ぎています。本人確認からやり直します。',
  reused: '使用済みの更新用トークンを検知し、同じ系列の更新を止めました。',
  revoked: 'この系列の更新は停止されています。',
  inactive: '利用者が無効のため、この系列の更新を止めました。',
  revoked_now: 'この系列の更新を停止しました。発行済みAccess Tokenの期限は変わりません。',
  expired_now: '実験操作でDBの更新期限を過去にしました。Access Tokenは書き換えていません。',
};
