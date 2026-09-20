import type { LabState, Layer, Result, Snapshot } from './types';

/** A before/after observation belongs to one real operation, not one replay frame. */
export type Observation = {
  action: string;
  result: Result;
  before: LabState;
  after: LabState | null;
};
export const actionNames: Record<string, string> = {
  login: 'ログイン', password: 'パスワード照合', profile: '自分の情報を見る',
  admin: '管理者だけの操作', logout: 'ログアウト', 'lab/expire': 'DBの期限を切らす',
};
export function requestSession(result: Result): string | null {
  return /(?:^|;\s*)lab_session=([^;]+)/.exec(result.http.requestHeaders.Cookie ?? '')?.[1] ?? null;
}
export function confirmedLogin(o: Observation): string | null {
  const id = o.result.state.cookie?.value;
  if (o.action !== 'login' || !o.result.success || !id || !o.after?.authenticated) return null;
  return o.after.cookie?.value === id && o.after.snapshot.sessions.some(s => s.id === id && s.user_id === o.after?.user?.id) ? id : null;
}
export function confirmedProfile(o: Observation, id: string): boolean {
  return o.action === 'profile' && o.result.http.status === 200 && o.result.success
    && requestSession(o.result) === id && o.result.http.requestBody === undefined
    && o.after?.cookie?.value === id && o.after.authenticated
    && o.after.snapshot.sessions.some(s => s.id === id && s.user_id === o.after?.user?.id);
}
export function confirmedLogout(o: Observation, id: string): boolean {
  return o.action === 'logout' && o.result.success && requestSession(o.result) === id
    && !!o.before.snapshot.sessions.find(s => s.id === id) && !!o.after
    && !o.after.cookie && !o.after.authenticated && !o.after.snapshot.sessions.some(s => s.id === id);
}
export type GuideProgress = { id: string | null; proofs: (Observation | null)[]; completed: number };
export function guideProgress(observations: Observation[]): GuideProgress {
  let id: string | null = null;
  let proofs: (Observation | null)[] = [null, null, null, null];
  for (const o of observations) {
    const newId = confirmedLogin(o);
    if (newId) { id = newId; proofs = [o, null, null, null]; continue; }
    if (!id) continue;
    if (!proofs[2] && confirmedProfile(o, id)) proofs[1] = o;
    if (proofs[1] && confirmedLogout(o, id)) proofs[2] = o;
    if (proofs[2] && o.action === 'profile' && o.result.http.status === 401
      && requestSession(o.result) === null && o.after && !o.after.authenticated && !o.after.cookie) proofs[3] = o;
  }
  return { id, proofs, completed: proofs.filter(Boolean).length };
}
export const challengeLabels = [
  ['番号を送って本人確認できた', 'ログイン後、同じ番号でProfile取得が成功'],
  ['間違ったパスワードでは記録が増えない', '401と、操作前後のSessionの一致を確認'],
  ['番号が残っていても期限切れなら使えない', 'CookieとDBの同じ番号を確認し、期限切れで401'],
  ['本人でも管理者の操作はできない', '一般ユーザーでログイン済みのまま403'],
  ['ログアウト後はアクセスできない', 'Cookie・DBの削除確認後、Profileが401'],
] as const;
export function challengeProofs(observations: Observation[]): (Observation | null)[] {
  const proofs: (Observation | null)[] = [null, null, null, null, null];
  const logins = new Set<string>();
  let loggedOut = false;
  for (const o of observations) {
    const id = confirmedLogin(o);
    if (id) { logins.add(id); loggedOut = false; }
    const sent = requestSession(o.result);
    if (sent && logins.has(sent) && confirmedProfile(o, sent)) proofs[0] = o;
    if (o.action === 'login' && o.result.http.status === 401 && o.after
      && o.result.trace.some(s => s.what === 'Password Hashを検証' && s.data.matched === false)
      && JSON.stringify(o.before.snapshot.sessions) === JSON.stringify(o.after.snapshot.sessions)) proofs[1] = o;
    if (o.action === 'profile' && o.result.http.status === 401 && sent && o.after?.cookie?.value === sent
      && o.after.sessionStatus === '期限切れ' && o.after.snapshot.sessions.some(s => s.id === sent)) proofs[2] = o;
    if (o.action === 'admin' && o.result.http.status === 403 && o.after?.authenticated && o.after.user?.role === 'user') proofs[3] = o;
    if (sent && confirmedLogout(o, sent)) loggedOut = true;
    if (loggedOut && o.action === 'profile' && o.result.http.status === 401 && sent === null
      && o.after && !o.after.cookie && !o.after.authenticated) proofs[4] = o;
  }
  return proofs;
}
export function sessionDiff(before?: Snapshot, after?: Snapshot) {
  if (!before || !after) return { added: [], removed: [], updated: [] };
  return {
    added: after.sessions.filter(s => !before.sessions.some(b => b.id === s.id)),
    removed: before.sessions.filter(s => !after.sessions.some(a => a.id === s.id)),
    updated: after.sessions.filter(s => before.sessions.some(b => b.id === s.id && (b.expires_at !== s.expires_at || b.user_id !== s.user_id))),
  };
}
export type Place = 'browser' | 'server' | 'database';
export function placeOf(layer: Layer): Place {
  if (layer === 'Database') return 'database';
  if (layer === 'Authentication Server' || layer === 'Resource API') return 'server';
  return 'browser';
}
export function shortId(id: string | null | undefined): string { return id ? `${id.slice(0, 10)}…` : 'なし'; }
