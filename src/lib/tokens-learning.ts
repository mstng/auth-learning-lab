import { readJwt } from './jwt-learning';
import type { TokensAction, TokensObservation, TokensSnapshot } from './tokens-types';

export const tokenLessons: { action: TokensAction; question: string; intro: string; button: string; choices: string[]; correct: number; answer: string }[] = [
  { action: 'issue', question: '2種類を発行すると、DBには何が残る？', intro: 'サンプル利用者で本人確認します。Access Tokenは実験用15秒、Refresh Tokenは30分です。Sessionの期限とは別です。', button: '2種類を発行する', choices: ['どちらの記録も残らない', '更新用の記録が残る', '両方のトークンがそのまま残る'], correct: 1, answer: 'DBにはRefresh Tokenのハッシュ・系列・期限を記録しました。Access Tokenは署名付きJWTで、個別の有効状態をDBに作りません。Refresh Tokenもこの教材では平文保存しません。' },
  { action: 'wrong-target', question: 'Refresh Tokenでも、Profileを取れる？', intro: '更新用の値を、あえてProfile APIのBearerとして送ります。送る先を変える実験です。', button: 'RefreshでProfileを取得する', choices: ['取得できる', '拒否される'], correct: 1, answer: 'このProfile APIはAccess JWTを検証するため、Refresh Tokenを受理しません。Refreshは更新の窓口だけに送り、日常のAPI呼び出しには使いません。長く使える値を持ち回る範囲を狭めるためです。' },
  { action: 'expired-access', question: 'Refreshが残っていれば、期限切れAccessも使える？', intro: '15秒のAccess Tokenを一字も変えず、実時間で期限を過ぎてから送ります。更新はまだ操作しません。', button: '同じAccessを期限後に送る', choices: ['使える', '拒否される'], correct: 1, answer: 'Refreshが手元にあっても、期限切れAccess Tokenは401でした。APIが自動で更新するわけではありません。クライアントから更新の窓口へ、別のリクエストを送る必要があります。' },
  { action: 'refresh', question: 'パスワードなしで更新すると、どの値が変わる？', intro: '現在のRefresh Tokenを更新の窓口へ送ります。更新後のAccess Tokenは5分です。', button: 'Refreshで更新する', choices: ['Accessだけ変わる', '両方変わる', 'どちらも変わらない'], correct: 1, answer: '新しいAccessと新しいRefreshの両方を受け取りました。古いRefreshは使用済みです。これをローテーションと呼びます。Refreshの期限は最初の発行から30分のままで、更新しても延長しません。古い値は実験用に控えました。' },
  { action: 'profile', question: '新しいAccess Tokenで、もう一度使える？', intro: '発行・更新とProfile取得は別操作です。新しく受け取ったAccess Tokenだけを送ります。', button: '新しいAccessでProfileを取得する', choices: ['取得できる', '拒否される'], correct: 0, answer: '新しい署名と期限のAccess Tokenで200になりました。短命にすると、漏れたAccess Tokenが使われる時間を抑えられます。一方、Refreshを奪われると新しいAccessを発行され得るので、更新側にも保護が必要です。' },
  { action: 'reuse', question: '使用済みの古いRefreshを、もう一度送ったら？', intro: '更新時に控えた古い値を、そのまま再送します。コピーの出所はAPIには分かりません。', button: '古いRefreshを再送する', choices: ['もう一度更新できる', '古い値だけ拒否される', 'この系列の更新が止まる'], correct: 2, answer: '使用済みの値を検知し、同じ系列（Token Family）全体を停止しました。正規利用者と第三者のどちらの再送かは特定できません。通信の再試行や同時更新でも起こり得るため、更新をむやみに再送しない設計も必要です。' },
  { action: 'blocked-refresh', question: '新しいRefreshなら、まだ更新できる？', intro: '古い値ではなく、手元の最新Refresh Tokenを更新の窓口へ送ります。', button: '最新Refreshで更新を試す', choices: ['更新できる', '拒否される'], correct: 1, answer: '新しい値でも、系列が停止済みなので拒否されました。古い値だけを拒否して新しい値を生かすと、どちらかが持つ新しい値から更新を続けられてしまいます。本人確認からやり直す必要があります。' },
  { action: 'still-access', question: '更新を止めたら、発行済みAccessもすぐ止まる？', intro: '先ほど更新で受け取った、5分のAccess Tokenをもう一度送ります。期限内の同じ値で比べます。', button: '保持中のAccessをもう一度送る', choices: ['すぐ拒否される', '期限内なら取得できる'], correct: 1, answer: 'この構成では、同じAccess Tokenが期限内なので200です。APIは署名と期限などを検証し、Refreshの停止状態は参照しません。「新しいAccessを増やせなくする」と「発行済みAccessを今止める」は別です。後者には別の失効確認などが要ります。' },
];

const unchanged = (a: TokensSnapshot, b: TokensSnapshot) => JSON.stringify(a.families) === JSON.stringify(b.families) && JSON.stringify(a.tokens) === JSON.stringify(b.tokens);
export function confirmsTokens(o: TokensObservation, previous?: TokensObservation): boolean {
  try {
    const r = o.result, pair = o.after.pair, old = o.before.pair;
    if (!pair || !r.before || !r.after || r.status !== r.http.status) return false;
    const minted = r.pair;
    if (o.action === 'issue' || o.action === 'refresh') {
      if (r.operation !== o.action || r.status !== 200 || r.code !== 'valid' || !minted
        || minted.accessToken !== pair.accessToken || minted.refreshToken !== pair.refreshToken) return false;
      const row = r.after.tokens.find(t => t.id === pair.refreshId);
      const family = r.after.families.find(f => f.id === pair.familyId);
      const { payload, header } = readJwt(pair.accessToken);
      if (!row || !family || family.revoked_at || row.revoked_at || row.used_at || row.family_id !== family.id
        || row.generation !== pair.generation || payload.sub !== row.user_id || header.alg !== 'RS256'
        || payload.exp! * 1000 !== Date.parse(pair.accessExpiresAt) || Date.parse(row.expires_at) !== Date.parse(pair.refreshExpiresAt)) return false;
      if (o.action === 'issue') return row.generation === 1 && !r.before.families.some(f => f.id === family.id);
      return !!old && previous?.after.pair?.refreshToken === old.refreshToken && pair.familyId === old.familyId
        && pair.generation === old.generation + 1 && pair.refreshToken !== old.refreshToken && pair.accessToken !== old.accessToken
        && o.after.oldRefresh === old.refreshToken && (r.http.requestBody as { refreshToken?: string })?.refreshToken === old.refreshToken
        && !!r.after.tokens.find(t => t.id === old.refreshId)?.used_at;
    }
    if (!old || previous?.after.pair?.accessToken !== old.accessToken || previous.after.pair.refreshToken !== old.refreshToken
      || pair.accessToken !== old.accessToken || pair.refreshToken !== old.refreshToken) return false;
    if (['wrong-target', 'expired-access', 'profile', 'still-access'].includes(o.action)) {
      if (r.operation !== 'profile' || !unchanged(r.before, r.after)) return false;
      const sent = o.action === 'wrong-target' ? pair.refreshToken : pair.accessToken;
      if (r.http.requestHeaders.Authorization !== `Bearer ${sent}`) return false;
      if (o.action === 'wrong-target') return r.status === 401 && r.code === 'malformed';
      if (o.action === 'expired-access') return r.status === 401 && r.code === 'expired' && readJwt(sent).payload.exp! * 1000 <= Date.parse(r.serverTime);
      return r.status === 200 && r.code === 'valid' && r.claims?.jti === readJwt(sent).payload.jti
        && (o.action !== 'still-access' || !!r.after.families.find(f => f.id === pair.familyId)?.revoked_at);
    }
    if (r.operation !== 'refresh' || r.familyId !== pair.familyId || r.pair || r.status !== 401) return false;
    const sent = (r.http.requestBody as { refreshToken?: string })?.refreshToken;
    const family = r.after.families.find(f => f.id === pair.familyId);
    if (o.action === 'reuse') return !!o.before.oldRefresh && sent === o.before.oldRefresh && r.code === 'reused'
      && !r.before.families.find(f => f.id === pair.familyId)?.revoked_at && family?.revoke_reason === 'reuse' && !!family.revoked_at
      && r.after.tokens.filter(t => t.family_id === pair.familyId).every(t => !!t.revoked_at);
    return o.action === 'blocked-refresh' && sent === pair.refreshToken && r.code === 'revoked' && !!family?.revoked_at && unchanged(r.before, r.after);
  } catch { return false; }
}
