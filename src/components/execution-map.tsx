'use client';
import { Monitor, Server, Database, ArrowDown, ArrowUp } from 'lucide-react';
import type { Snapshot, Step } from '@/lib/types';
import { placeOf, sessionDiff, shortId, type Place } from '@/lib/learning';
import { plainStep } from '@/lib/plain-language';
const places = [
  { id: 'browser', name: 'ブラウザ', role: '画面の操作・Cookieの保存と送信', Icon: Monitor },
  { id: 'server', name: 'サーバー', role: '本人確認・利用可否の判断', Icon: Server },
  { id: 'database', name: 'データベース', role: '登録情報・受付番号の対応表を保存', Icon: Database },
] as const;
function Bridge({ from, to, step }: { from: Place; to: Place; step?: Step }) {
  const a = step ? placeOf(step.from) : null, b = step ? placeOf(step.to) : null;
  const forward = a === from && b === to, backward = a === to && b === from;
  return <div className="execution-bridge">
    <span className={forward ? 'active' : ''} data-active={forward}><ArrowDown size={23} aria-hidden="true" />{from === 'browser' ? '依頼・Cookieを送る' : 'データを読む・書く'}{forward && <b>このステップ</b>}</span>
    <span className={backward ? 'active' : ''} data-active={backward}><ArrowUp size={23} aria-hidden="true" />{from === 'browser' ? '結果・保存指示を返す' : '保存情報を渡す'}{backward && <b>このステップ</b>}</span>
  </div>;
}
export function ExecutionMap({ step, previous, number }: { step?: Step; previous?: Snapshot; number: number }) {
  const current = step ? placeOf(step.location) : null;
  const diff = sessionDiff(previous, step?.snapshot);
  const value = step?.data.session_id ?? step?.data.value;
  const cookieText = step?.data.Cookie ?? step?.data['Set-Cookie'];
  const id = typeof value === 'string' ? value : typeof cookieText === 'string' ? /lab_session=([^;]+)/.exec(cookieText)?.[1] : undefined;
  return <div className="execution-map" aria-label="実行記録と連動する図">
    <div className="execution-caption"><strong>{step ? `STEP ${number} · ${plainStep(step)?.title}` : '実行すると、図が記録と一緒に動きます'}</strong><small>図は選択した時点の記録です。現在の状態は右の欄で確認できます。</small></div>
    {places.map(({ id, name, role, Icon }, i) => <div key={id}>
      <article className={`execution-place ${current === id ? 'active' : ''}`} data-place={id} data-current={current === id}>
        <Icon size={24} /><div><strong>{name}</strong><small>{role}</small></div>{current === id && <span className="tag">今ここ</span>}
      </article>
      {i < 2 && <Bridge from={id} to={places[i + 1].id} step={step} />}
    </div>)}
    {step && <div className="execution-evidence" aria-live="polite">
      <p>{placeOf(step.from) === placeOf(step.to) ? '同じ場所の中で行う処理です。' : '緑の矢印が、選択したステップの情報の向きです。'}</p>
      {id && <p>この処理で扱う受付番号：<code title={id}>{shortId(id)}</code></p>}
      <p className="step-db-diff">このステップのDB：{diff.added.length ? `${diff.added.length}件追加` : diff.removed.length ? `${diff.removed.length}件削除` : diff.updated.length ? `${diff.updated.length}件更新` : '変更なし'}{diff.added.length > 0 && diff.removed.length > 0 ? `・${diff.removed.length}件削除（番号を入れ替え）` : ''}</p>
      <small>{step.evidence === 'browser-model' ? 'ブラウザ内の動きは説明モデルです。Cookieの保存結果は操作後の確認リクエストで検証しています。' : 'サーバーで記録した処理に基づきます。'}</small>
    </div>}
  </div>;
}
