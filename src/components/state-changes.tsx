import type { LabState } from '@/lib/types';
import { actionNames, sessionDiff, shortId, type Observation } from '@/lib/learning';
function CookieValue({ state }: { state: LabState }) {
  return state.cookie ? <code title={state.cookie.value}>{shortId(state.cookie.value)}</code> : <span>なし</span>;
}
function StateColumn({ state, label }: { state: LabState; label: string }) {
  return <section className="comparison-column" aria-label={label}>
    <h3>{label}<small>{new Date(state.serverTime).toLocaleTimeString('ja-JP')}</small></h3>
    <dl><div><dt>ブラウザから届いた番号</dt><dd><CookieValue state={state} /></dd></div>
      <div><dt>サーバーの判断</dt><dd>{state.authenticated ? 'ログイン中' : '未ログイン'}<small>{state.sessionStatus}</small></dd></div>
      <div><dt>DBのSession</dt><dd>{state.snapshot.sessions.length}件</dd></div>
      <div><dt>DBの番号 → 利用者 → 期限</dt><dd>{state.snapshot.sessions.length ? <ul>{state.snapshot.sessions.map(s => <li key={s.id}><code title={s.id}>{shortId(s.id)}</code> → {state.snapshot.users.find(u => u.id === s.user_id)?.email ?? s.user_id}<br /><time>{new Date(s.expires_at).toLocaleTimeString('ja-JP')}</time></li>)}</ul> : '記録なし'}</dd></div>
    </dl>
  </section>;
}
export function StateChanges({ observation, number }: { observation?: Observation; number: number }) {
  if (!observation) return <section className="panel changes-panel" aria-label="変更前・変更後"><h2>変更前・変更後</h2><p>操作すると、CookieとDBの変化をここに並べます。</p></section>;
  const { before, after, action } = observation;
  const diff = sessionDiff(before.snapshot, after?.snapshot);
  const changed = before.cookie?.value !== after?.cookie?.value;
  return <section className="panel changes-panel" aria-label="変更前・変更後">
    <div className="changes-heading"><div><span className="eyebrow">操作 {number} · {actionNames[action] ?? action}</span><h2>変更前・変更後を比べる</h2></div><span className="tag">選択した操作全体の比較</span></div>
    <p>上の図は1ステップずつ、こちらはその操作の直前・直後です。過去の記録を選ぶと、この比較も切り替わります。</p>
    {after ? <>
      <div className="change-summary" aria-live="polite"><span>{changed ? after.cookie ? before.cookie ? 'Cookie：番号を入れ替え' : 'Cookie：番号を保存' : 'Cookie：番号を削除' : 'Cookie：変更なし'}</span><span>DB：{diff.added.length}件追加 / {diff.removed.length}件削除 / {diff.updated.length}件更新</span></div>
      <div className="comparison-grid"><StateColumn state={before} label="変更前" /><StateColumn state={after} label="変更後" /></div>
      <details className="comparison-values"><summary>省略していない番号で比べる</summary><dl><dt>変更前のCookie</dt><dd>{before.cookie?.value ?? 'なし'}</dd><dt>変更後のCookie</dt><dd>{after.cookie?.value ?? 'なし'}</dd><dt>変更前のDBの番号</dt><dd>{before.snapshot.sessions.map(s => s.id).join('\n') || 'なし'}</dd><dt>変更後のDBの番号</dt><dd>{after.snapshot.sessions.map(s => s.id).join('\n') || 'なし'}</dd></dl></details>
    </> : <div className="notice error">操作後の確認通信に失敗したため、比較と達成判定は保留です。操作結果そのものは実行記録に残しています。</div>}
    <p className="inspector-note">CookieはJavaScriptから直接読まず、操作の前後に確認APIへ自動送信された値を表示しています。図の再生でCookieやDBが巻き戻ることはありません。</p>
  </section>;
}
