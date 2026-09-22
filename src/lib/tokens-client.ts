import { emptyTokensMemory, type TokensAction, type TokensMemory, type TokensObservation, type TokensResult } from './tokens-types';

export async function initializeTokens() {
  const response = await fetch('/api/lab/init', { method: 'POST', credentials: 'same-origin', headers: { 'X-Lab-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
  if (!response.ok) throw new Error('学習空間の準備に失敗しました。');
}

export async function runTokens(action: TokensAction, memory: TokensMemory, ttl: 15 | 300 = 15): Promise<TokensObservation> {
  const pair = memory.pair;
  if (action !== 'issue' && !pair) throw new Error('先に2種類のトークンを発行してください。');
  const profile = ['wrong-target', 'expired-access', 'profile', 'still-access'].includes(action);
  const operation = profile ? 'profile' : action === 'issue' || action === 'revoke' || action === 'expire' ? action : 'refresh';
  const token = action === 'wrong-target' ? pair?.refreshToken : pair?.accessToken;
  const refreshToken = action === 'reuse' ? memory.oldRefresh : pair?.refreshToken;
  if (action === 'reuse' && !refreshToken) throw new Error('一度更新すると、使用済みの値を再送できます。');
  const body = profile ? undefined : action === 'issue' ? { email: 'sample@example.com', password: 'LearnSession!2026', ttl } : { refreshToken };
  const response = await fetch(`/api/tokens/${operation}`, { method: profile ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: { 'X-Lab-Request': '1', ...(profile ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' }) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result: TokensResult = await response.json();
  if (!result.requestId || result.operation !== operation || result.status !== response.status || result.http?.status !== response.status || !result.before?.tokens || !result.after?.tokens || !Array.isArray(result.trace) || !result.trace.length) throw new Error('操作の結果を確認できませんでした。');
  let after = memory;
  if (result.code === 'valid' && result.pair) after = { pair: result.pair, oldRefresh: action === 'refresh' ? pair!.refreshToken : null };
  return { action, result, before: action === 'issue' ? emptyTokensMemory : memory, after };
}
