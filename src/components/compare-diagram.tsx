'use client';
import { Database, Monitor, Server } from 'lucide-react';
import { tokenLabel } from '@/lib/jwt-learning';
import { shortId } from '@/lib/learning';
import type { CompareObservation } from '@/lib/compare-types';

export function CompareDiagram({ observation: o, frame }: { observation: CompareObservation; frame: number }) {
  const current = o.steps[frame];
  const pair = o.memoryAfter.copy;
  return <div className="compare-map" aria-label="2方式の保存・一時利用・DB記録">
    <div className="compare-place" data-current={current?.place === 'browser'}><Monitor size={22} /><h3>ブラウザ <small>保存</small></h3>
      <dl><div><dt>SessionのCookie</dt><dd><code>{shortId(o.before.cookie?.value)} → {shortId(o.after.cookie?.value)}</code></dd></div>
        <div><dt>通常利用用JWT</dt><dd><code>{o.memoryBefore.activeJwt ? 'あり' : 'なし'} → {o.memoryAfter.activeJwt ? 'あり' : 'なし'}</code></dd></div></dl>
      <p className="compare-copy">実験用コピーは別に保持<br /><code>Session {shortId(pair?.sessionId)}</code><br /><code>JWT {tokenLabel(pair?.jwt ?? null)}</code></p>
    </div>
    <div className="compare-place" data-current={current?.place === 'server'}><Server size={22} /><h3>サーバー <small>一時利用</small></h3>
      <strong>{current ? '選択した処理の記録' : '処理終了'}</strong>
      {current?.place === 'server' && <code>{o.action === 'replay' ? 'コピーの値を照合' : '受信した値を処理'}</code>}
      <dl><div><dt>Session</dt><dd>DBに対応を尋ねる</dd></div><div><dt>JWT</dt><dd>公開鍵・利用条件で検証</dd></div></dl><small>署名鍵は別途保存</small>
    </div>
    <div className="compare-place" data-current={current?.place === 'database'}><Database size={22} /><h3>DB <small>記録</small></h3>
      <dl><div><dt>Session行数（実測）</dt><dd data-testid="compare-session-count">{o.before.snapshot.sessions.length} → {o.after.snapshot.sessions.length}件</dd></div>
        <div><dt>今回のIDの対応</dt><dd>{o.after.snapshot.sessions.some(s => s.id === pair?.sessionId) ? '記録あり' : '記録なし'}</dd></div></dl>
      {o.jwt && <small>JWT APIでのSession行数：{o.jwt.before.sessions.length} → {o.jwt.after.sessions.length}件</small>}
      <p>JWTごとの有効状態は保存しない設計。usersと観察用のDB照会はあります。</p>
    </div>
    <p className="compare-map-note">配置・強調は説明モデル。値はこの操作全体の前 → 後の実測値です。強調は選択した記録の場所を示し、処理終了の表示は実メモリー消去を意味しません。</p>
  </div>;
}
