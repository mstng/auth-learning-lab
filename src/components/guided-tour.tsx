'use client';
import type { LabState } from '@/lib/types';
import { guideProgress, type Observation } from '@/lib/learning';
const stages = [
  { title: 'ログインする', action: 'login', button: '① ログインする', description: 'パスワードで本人を確認し、受付番号を作ります。', proof: '発行した番号が、確認リクエストのCookieとDBで一致しました。' },
  { title: '番号だけでアクセスする', action: 'profile', button: '② 自分の情報を見る', description: '今度はパスワードを送らずに、プロフィールを取得します。', proof: 'パスワードを送らず、同じ受付番号でProfile取得に成功しました。' },
  { title: 'ログアウトする', action: 'logout', button: '③ ログアウトする', description: 'ブラウザの番号と、サーバーの対応表の記録を片付けます。', proof: '元の番号がDBから消え、確認リクエストにもCookieがありません。' },
  { title: '使えなくなったか確かめる', action: 'profile', button: '④ もう一度、自分の情報を見る', description: 'ログアウト後のアクセスは拒否されるはずです。試して確かめます。', proof: 'CookieなしのProfile取得が401になりました。この拒否が正しい結果です。' },
];
export function GuidedTour({ active, records, state, busy, onStart, onExit, onRun, onReview }: {
  active: boolean; records: Observation[]; state: LabState | null; busy: boolean;
  onStart: () => void; onExit: () => void; onRun: (action: string) => void; onReview: (o: Observation) => void;
}) {
  const progress = guideProgress(records);
  const stage = stages[progress.completed];
  const recovery = active && progress.completed > 0 && progress.completed < 3
    && state && (!state.authenticated || state.cookie?.value !== progress.id);
  return <section className="panel guided-tour" aria-label="5分のガイド付き体験">
    <div className="tour-heading"><div><span className="eyebrow">目安5分 · 操作は4回</span><h2>ログインして、番号を使って、片付ける。</h2></div><span className="tour-count">{active ? `${progress.completed} / 4 確認できた` : 'はじめての方へ'}</span></div>
    {!active ? <><p>次に押すボタンと、見るポイントを1つずつ案内します。開始すると、この学習空間のSessionと画面の記録を初期化します。</p><button className="button primary" disabled={busy || !state} onClick={onStart}>5分ガイドを始める</button></> : <>
      <ol className="tour-stages">{stages.map((s, i) => <li key={s.title} className={progress.proofs[i] ? 'done' : progress.completed === i ? 'current' : ''} aria-current={progress.completed === i ? 'step' : undefined}><span>{progress.proofs[i] ? '✓' : i + 1}</span>{s.title}</li>)}</ol>
      <div className="tour-prompt" aria-live="polite">
        {stage ? <><strong>{recovery ? '番号が使えなくなっています。ログインからやり直しましょう。' : stage.description}</strong><p>{progress.completed > 0 ? '下の図と「変更前・変更後」で、直前の操作を見返せます。番号は短く表示していますが、判定には全桁を使います。' : '入力済みの一般ユーザー・5分の期限で実行します。プロフィールはまだ取得しません。'}</p>
          <button className="button primary tour-next" disabled={busy} onClick={() => onRun(recovery ? 'login' : stage.action)}>{busy ? '実行・確認中…' : recovery ? 'もう一度ログインする' : stage.button}</button></>
        : <><strong>4つの実験を確認できました。</strong><p>本人確認 → 番号の再利用 → 両方を削除 → 利用拒否。この流れがSession認証の基本です。</p><p>自分の言葉で「Cookieがあるだけではログイン済みと言えない理由」を説明してみましょう。</p></>}
      </div>
      <div className="tour-proofs">{progress.proofs.map((o, i) => o ? <div key={i}><span>✓ {stages[i].proof}</span><button className="text-button" onClick={() => onReview(o)}>記録を見る</button></div> : null)}</div>
      <div className="tour-footer"><small>達成は実際の通信・DB・Cookieの受信結果で判定します。理解そのものを自動判定するものではありません。再読み込みでガイドと記録はリセットされます。</small><button className="button small" disabled={busy} onClick={onExit}>ガイドを閉じて自由に実験</button></div>
    </>}
  </section>;
}
