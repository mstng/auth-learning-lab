import { Database, Monitor, Server } from 'lucide-react';
import { tokenLabel } from '@/lib/jwt-learning';
import type { TokensObservation, TokensResult } from '@/lib/tokens-types';

export const tokenTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }) + ' JST' : 'なし';
export function tokensOutcome(r: TokensResult) {
  if (r.operation === 'profile') return r.code === 'valid' ? 'Profileを取得できました' : 'アクセスを拒否されました';
  if (r.code === 'revoked_now') return 'この系列の更新を停止しました';
  if (r.code === 'expired_now') return 'DBの更新期限を過去にしました';
  if (r.code === 'reused') return '再利用を検知し、この系列を停止しました';
  if (r.code !== 'valid') return r.operation === 'issue' ? '発行を拒否されました' : '更新を拒否されました';
  return r.operation === 'issue' ? '2種類を発行しました' : '2種類とも新しい値になりました';
}
export function TokensEvidence({ observation: o, frame, detailed }: { observation: TokensObservation; frame: number; detailed: boolean }) {
  const r = o.result, pair = o.after.pair, step = r.trace[frame];
  const familyId = r.familyId ?? pair?.familyId;
  const beforeFamily = r.before.families.find(f => f.id === familyId);
  const family = r.after.families.find(f => f.id === familyId);
  const rows = r.after.tokens.filter(t => t.family_id === familyId);
  const state = (f: typeof family, at: string) => !f ? 'なし' : f.revoked_at ? '停止済み' : Date.parse(f.expires_at) <= Date.parse(at) ? '期限切れ' : '更新可能';
  return <>
    <div className="tokens-map" aria-label="ブラウザ・サーバー・DBの観測">
      <div className="tokens-place"><Monitor size={22} /><h3>ブラウザ<small>画面内で保持</small></h3>
        <dl><dt>Access Token</dt><dd><code>{tokenLabel(pair?.accessToken ?? null)}</code></dd><dt>Refresh Token（第{pair?.generation ?? '—'}世代）</dt><dd><code>{tokenLabel(pair?.refreshToken ?? null)}</code></dd></dl>
        <p>{o.before.pair && r.pair ? '両方の値を入れ替えました' : pair ? 'この操作後に保持している値' : 'まだ値はありません'}</p>
        <small>古いRefreshのコピー：{o.after.oldRefresh ? 'あり（実験用）' : 'なし'}</small>
      </div>
      <div className="tokens-place" data-current={step?.place === 'server'}><Server size={22} /><h3>サーバー<small>リクエスト内で一時利用</small></h3>
        <strong>{step ? step.place === 'server' ? step.title : 'DBの記録を確認' : '処理終了'}</strong>
        <p>{r.operation === 'profile' ? 'APIの窓口：Access JWTを検証' : '更新の窓口：発行・更新を管理'}</p>
        <small>{r.operation === 'profile' ? 'このAPIはRefreshの停止を照会して判断しない' : '更新用の値はハッシュでDBと照合'}</small>
      </div>
      <div className="tokens-place" data-current={step?.place === 'database'}><Database size={22} /><h3>DB<small>更新用の記録（実測）</small></h3>
        <strong data-testid="tokens-family-state">{state(beforeFamily, r.before.capturedAt)} → {state(family, r.after.capturedAt)}</strong>
        <p>この系列の記録：{r.before.tokens.filter(t => t.family_id === familyId).length} → {rows.length}件</p>
        {rows.map(row => <div className="tokens-generation" key={row.id}><b>第{row.generation}世代</b>：{row.revoked_at ? '停止済み' : row.used_at ? '使用済み' : '未使用'}<small>保存ハッシュ：{row.token_hash.slice(0, 10)}…</small></div>)}
        <small>平文のRefresh・Accessは保存しない設計</small>
      </div>
    </div>
    <p className="tokens-caption">配置と強調は説明用。値とDB状態はこの操作の実記録です。「処理終了」は実メモリー消去の意味ではありません。</p>
    {detailed && <div className="tokens-expiries"><p>Accessの署名付き期限：{tokenTime(pair?.accessExpiresAt)}</p><p>DBの更新期限：{tokenTime(family?.expires_at)}（Session期限とは別）</p><p>系列ID：<code>{familyId ?? 'なし'}</code>。世代番号はトークンのローテーション回数です。</p></div>}
  </>;
}

export function TokensRecord({ observation: o }: { observation: TokensObservation }) {
  return <details className="tokens-record"><summary>詳しい記録を見る（送信先・値・DB前後）</summary>
    <p>実際のHTTP記録の抜粋とDB観測。パスワードは伏せています。Refreshの平文は今回の通信と画面内の実験用記録にだけ現れ、DBはハッシュを保持します。</p>
    <pre>{JSON.stringify({ http: o.result.http, before: o.result.before, after: o.result.after, memoryBefore: o.before, memoryAfter: o.after }, null, 2)}</pre>
    <small>再読み込みで画面内の値・コピー・履歴は消えます。DBの系列は消えません。履歴の表示は状態の巻き戻しではありません。</small>
  </details>;
}
