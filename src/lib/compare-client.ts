import type { LabState, Result } from './types';
import type { JwtResult } from './jwt-types';
import type { CompareAction, CompareDraft, CompareMemory, CompareStep, SessionReplayResult } from './compare-types';

async function call<T>(path: string, method = 'GET', body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method, cache: 'no-store', credentials: 'same-origin',
    headers: { 'X-Lab-Request': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (path === 'lab/state' || path === 'lab/init') {
    if (!response.ok || !data.state?.snapshot || !data.state?.serverTime) throw new Error(data.message ?? '操作後の観測を取得できませんでした。');
  } else if (!data.requestId || !Array.isArray(data.trace) || (data.status ?? data.http?.status) !== response.status) {
    throw new Error(data.message ?? '通信結果の記録を取得できませんでした。');
  }
  return data as T;
}
export async function compareState(init = false): Promise<LabState> {
  return (await call<{ state: LabState }>(init ? 'lab/init' : 'lab/state', init ? 'POST' : 'GET', init ? {} : undefined)).state;
}
const step = (place: CompareStep['place'], source: CompareStep['source'], title: string, text: string, detail: string): CompareStep => ({ place, source, title, text, detail });
export async function executeComparison(action: CompareAction, memory: CompareMemory, setMemory: (memory: CompareMemory) => void): Promise<CompareDraft> {
  const before = await compareState();
  const draft: CompareDraft = { id: crypto.randomUUID(), action, before, memoryBefore: memory, memoryAfter: memory, steps: [] };
  const pair = memory.copy;
  if (action !== 'prepare' && !pair) throw new Error('先に両方を発行してください。');
  if ((action === 'access' || action === 'logout') && (before.cookie?.value !== pair?.sessionId || !memory.activeJwt)) {
    throw new Error('発行したSessionと現在のCookie、または通常利用用JWTが一致しません。両方の発行からやり直してください。');
  }
  if (action === 'prepare') {
    const credentials = { email: 'sample@example.com', password: 'LearnSession!2026', ttl: 300 };
    draft.session = await call<Result>('login', 'POST', credentials);
    const sessionId = draft.session.state.cookie?.value;
    if (!draft.session.success || !sessionId) throw new Error('Sessionを発行できませんでした。');
    draft.jwt = await call<JwtResult>('jwt/issue', 'POST', credentials);
    if (draft.jwt.code !== 'valid' || !draft.jwt.token) throw new Error('JWTを発行できませんでした。Sessionだけ発行済みの可能性があります。');
    draft.memoryAfter = { activeJwt: draft.jwt.token, copy: { sessionId, jwt: draft.jwt.token } };
    setMemory(draft.memoryAfter);
    draft.steps = [
      step('database', 'server', 'SessionはDBに対応表を作る', '本人確認後、IDと利用者・期限をDBに記録しました。', '既存のPOST /api/loginを使用。ログインの実行記録とDBスナップショットに同じIDがあります。'),
      step('server', 'server', 'JWTは内容に署名する', '利用者や期限を含むJWTを作りました。JWTごとの有効状態はDBに追加しません。', '既存のPOST /api/jwt/issue。RS256 / jose。JWT APIの操作前後のSession行も比較しています。'),
      step('browser', 'browser', '通常利用用と実験用コピーを保持', 'SessionはCookie、JWTは画面内。コピーはどちらもこの画面内だけに控えました。', 'Session IDのコピーは教材APIの観測値から取得。HttpOnly CookieをJavaScriptで読んだわけではありません。'),
    ];
  } else if (action === 'access') {
    draft.session = await call<Result>('profile');
    draft.jwt = await call<JwtResult>('jwt/profile', 'GET', undefined, memory.activeJwt!);
    draft.steps = [
      step('database', 'server', `Session：HTTP ${draft.session.http.status}`, '届いたCookieのIDからDBの対応・期限・利用者状態を確認しました。', draft.session.message),
      step('server', 'server', `JWT：HTTP ${draft.jwt.status}`, '届いたBearerの署名・発行者・宛先・期限などを検証しました。', `${draft.jwt.message} JWTの属性は発行時の値です。観察用DB照会は認証用Session照会とは別です。`),
    ];
  } else if (action === 'logout') {
    draft.session = await call<Result>('logout', 'POST', {});
    if (!draft.session.success) throw new Error('Sessionのログアウトを確認できませんでした。');
    draft.memoryAfter = { activeJwt: null, copy: pair! };
    setMemory(draft.memoryAfter);
    draft.steps = [
      step('database', 'server', 'SessionのDB記録を削除', 'サーバーが、このIDと利用者の対応を手放しました。', '既存POST /api/logoutで対象IDだけを削除。Cookieには削除のSet-Cookieを返しています。'),
      step('browser', 'browser', 'JWTは通常利用用の値を手放す', 'この教材のJWTログアウトは画面内の保持をやめる操作です。失効APIへの通信はありません。', 'activeJwtをnullに更新。署名鍵やJWTのexpは変えません。メモリー消去の保証ではありません。'),
      step('browser', 'browser', 'コピーは別に残しておく', 'ログアウト前に控えたSession IDとJWTを次の実験で使います。', '実験用コピーと履歴はページ内のみ。再読み込みで消えます。'),
    ];
  } else {
    draft.replay = await call<SessionReplayResult>('compare/session-replay', 'POST', { sessionId: pair!.sessionId });
    draft.jwt = await call<JwtResult>('jwt/profile', 'GET', undefined, pair!.jwt);
    draft.steps = [
      ...draft.replay.trace,
      step('server', 'server', `JWTの再送：HTTP ${draft.jwt.status}`, draft.jwt.message, '同じJWTの全桁をAuthorization: Bearerで再送。SessionログアウトのDB削除はJWTの署名や期限を変えません。'),
    ];
  }
  return draft;
}
