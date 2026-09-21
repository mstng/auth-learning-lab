'use client';
import { ArrowRight, ArrowLeft, Monitor, Server, Database } from 'lucide-react';
import type { LabState, Step } from '@/lib/types';
import { placeOf, requestSession, shortId, type Observation } from '@/lib/learning';
const places = [
  { id: 'browser', label: 'ブラウザ', role: '番号を保存・送信', Icon: Monitor },
  { id: 'server', label: 'サーバー', role: '本人かどうか判断する', Icon: Server },
  { id: 'database', label: 'DB', role: '番号と利用者を記録する', Icon: Database },
] as const;
function dataId(step?: Step): string | null {
  if (!step) return null;
  if (typeof step.data.session_id === 'string') return step.data.session_id;
  if (typeof step.data.value === 'string') return step.data.value;
  for (const key of ['Cookie', 'Set-Cookie']) {
    const value = step.data[key];
    if (typeof value === 'string') {
      const id = /(?:^|;\s*)lab_session=([^;]+)/.exec(value)?.[1];
      if (id) return id;
    }
  }
  return null;
}
/** Replay uses per-step snapshots. Browser changes are modeled only where the trace describes them. */
export function LessonDiagram({ step, observation, state, finished = false }: {
  step?: Step; observation?: Observation | null; state?: LabState | null; finished?: boolean;
}) {
  const from = step ? placeOf(step.from) : null, to = step ? placeOf(step.to) : null;
  const trace = observation?.result.trace ?? [];
  const position = step ? trace.findIndex(s => s.id === step.id) : -1;
  const generated = trace.findIndex(s => s.what === 'Session IDを生成');
  const oldId = observation?.before.cookie?.value ?? null;
  const newId = generated >= 0 ? dataId(trace[generated]) : null;
  const after = finished ? observation?.after : null;
  const browserId = observation
    ? finished ? after?.cookie?.value ?? null : step?.what === 'Cookieの保存をブラウザーへ指示' ? newId : oldId
    : state?.cookie?.value ?? null;
  const serverId = observation
    ? finished ? after?.cookie?.value ?? null : generated >= 0 && position >= generated ? newId : requestSession(observation.result)
    : null;
  const snapshot = observation ? finished ? after?.snapshot : step?.snapshot ?? observation.before.snapshot : state?.snapshot;
  const relevantId = serverId ?? browserId ?? oldId;
  const row = snapshot?.sessions.find(s => s.id === relevantId) ?? snapshot?.sessions.find(s => s.id === oldId);
  const clock = finished ? after?.serverTime : step?.at ?? state?.serverTime;
  const expired = !!row && !!clock && Date.parse(row.expires_at) <= Date.parse(clock);
  const ids = { browser: browserId, server: serverId, database: row?.id ?? null };
  const labels = {
    browser: step?.what === 'Cookieを削除するレスポンス' ? '削除指示を受信' : browserId ? 'Cookieに保存' : '番号なし',
    server: finished ? observation?.result.http.status === 401 ? '本人確認できず拒否' : observation?.action === 'lab/expire' ? '期限の変更が完了' : observation?.action === 'logout' ? 'ログアウトが完了' : '本人確認できた' : serverId ? '今回扱う番号' : step ? observation?.action === 'login' ? 'パスワードで確認' : '受付番号なし' : '次の操作を待つ',
    database: row ? expired ? '期限切れの記録' : '利用者と期限の記録' : '対応する記録なし',
  };
  const transferId = dataId(step);
  const moving = !!transferId && from !== to;
  const travel = { '--packet-from': `${16 + places.findIndex(p => p.id === from) * 34}%`, '--packet-to': `${16 + places.findIndex(p => p.id === to) * 34}%` } as React.CSSProperties;
  return <div className="number-map" aria-label="実際の受付番号を追う図">
    <div className="lesson-diagram" aria-label="ブラウザ・サーバー・DBのつながり">
      {places.map(({ id, label, role, Icon }, i) => <div className="lesson-node-group" key={id}>
        <div className="lesson-node" data-place={id} data-current={step ? placeOf(step.location) === id : false}>
          <Icon size={25} aria-hidden="true" /><strong>{label}</strong>
          {!state && !observation ? <small>{role}</small> : <>
            <code className={`number-chip ${ids[id] ? '' : 'empty'}`} data-session-id={ids[id] ?? ''} title={ids[id] ?? undefined}>{shortId(ids[id])}</code>
            <small className={id === 'database' && expired ? 'expired-label' : ''}>{labels[id]}</small>
          </>}
          <span className="lesson-location">{step && placeOf(step.location) === id ? 'この処理の場所' : '\u00a0'}</span>
        </div>
        {i < 2 && <div className="lesson-arrows" aria-label={`${label}と${places[i + 1].label}の通信`}>
          <ArrowRight data-active={from === id && to === places[i + 1].id} aria-label="右向き" />
          <ArrowLeft data-active={to === id && from === places[i + 1].id} aria-label="左向き" />
        </div>}
      </div>)}
    </div>
    {step && <div className="number-travel" key={step.id}>
      {moving && <div className="packet-track" style={travel}><code className="travel-packet" data-session-id={transferId}>{shortId(transferId)}</code></div>}
      <p>{moving ? `${places.find(p => p.id === from)?.label} → ${places.find(p => p.id === to)?.label}：この番号を渡す`
        : step.what === 'Session IDを生成' ? 'サーバーが新しい番号を作りました。まだブラウザにはありません。'
        : step.what === 'CookieをAPIへ送信' && !transferId ? '番号なしでアクセスしています。'
        : step.what === 'Cookieを削除するレスポンス' ? 'サーバー → ブラウザ：Cookieの削除を指示'
        : '緑の枠が、この処理を行った場所です。'}</p>
    </div>}
    {(state || observation) && <small className="number-caption">{step ? '選択した処理時点の記録。Cookieの動きは説明モデルです。' : observation ? observation.after ? 'この操作直後に確認した結果です。' : '操作後の状態は未確認です。' : '最後に確認した状態です。'} 番号は短縮表示しています。</small>}
  </div>;
}
