'use client';
import { useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Monitor, Server, Database, CheckCircle2 } from 'lucide-react';
import type { LabState, Step } from '@/lib/types';
import { guideProgress, placeOf, requestSession, shortId, type Observation } from '@/lib/learning';
import { plainStep } from '@/lib/plain-language';
import { HttpView } from './inspectors';

const lessons = [
  { question: 'ログインすると、何が保存される？', intro: '本人確認ができたら、次のアクセスに使う「受付番号」を作ります。', action: 'login', button: 'ログインして確かめる', answer: 'ブラウザには番号、DBには「番号と利用者の対応」が保存されました。', frames: [3, 6, 7, 8] },
  { question: '次のアクセスでは、何を送る？', intro: 'パスワードを入力し直さずに、自分のプロフィールを開いてみましょう。', action: 'profile', button: '自分の情報を見る', answer: '同じ番号を送り、パスワードを送らずにプロフィールを取得できました。', frames: [1, 2, 3] },
  { question: 'ログアウトすると、何が消える？', intro: 'ブラウザの番号とDBの対応表が、それぞれどう変わるか確かめます。', action: 'logout', button: 'ログアウトして確かめる', answer: 'ブラウザの番号と、DBにあるその番号の記録が、両方とも消えました。', frames: [1, 2] },
  { question: 'ログアウト後も、情報を見られる？', intro: 'もう一度、同じプロフィールを開いてみましょう。', action: 'profile', button: 'もう一度、自分の情報を見る', answer: '番号を送れないので、プロフィールを取得できませんでした。この拒否が正しい結果です。', frames: [1, 3] },
] as const;
const places = [
  { id: 'browser', label: 'ブラウザ', role: '番号を保存・送信', Icon: Monitor },
  { id: 'server', label: 'サーバー', role: '本人かどうか判断する', Icon: Server },
  { id: 'database', label: 'DB', role: '番号と利用者を記録する', Icon: Database },
] as const;

function LessonDiagram({ step }: { step?: Step }) {
  const from = step ? placeOf(step.from) : null;
  const to = step ? placeOf(step.to) : null;
  return <div className="lesson-diagram" aria-label="ブラウザ・サーバー・DBのつながり">
    {places.map(({ id, label, role, Icon }, i) => <div className="lesson-node-group" key={id}>
      <div className="lesson-node" data-place={id} data-current={step ? placeOf(step.location) === id : false}>
        <Icon size={27} aria-hidden="true" /><strong>{label}</strong><small>{role}</small>
        <span className="lesson-location">{step && placeOf(step.location) === id ? 'この処理の場所' : '\u00a0'}</span>
      </div>
      {i < 2 && <div className="lesson-arrows" aria-label={`${label}と${places[i + 1].label}の通信`}>
        <ArrowRight data-active={from === id && to === places[i + 1].id} aria-label="右向き" />
        <ArrowLeft data-active={to === id && from === places[i + 1].id} aria-label="左向き" />
      </div>}
    </div>)}
  </div>;
}
function CompactChanges({ observation }: { observation: Observation }) {
  const { before, after } = observation;
  if (!after) return null;
  return <div className="lesson-comparison" aria-label="この操作の変更前と変更後">
    <table><thead><tr><th scope="col">保存場所</th><th scope="col">変更前</th><th scope="col">変更後</th></tr></thead>
      <tbody><tr><th scope="row">ブラウザの番号</th><td><code>{shortId(before.cookie?.value)}</code></td><td><code>{shortId(after.cookie?.value)}</code></td></tr>
        <tr><th scope="row">DBの対応表</th><td>{before.snapshot.sessions.length}件</td><td>{after.snapshot.sessions.length}件</td></tr></tbody>
    </table>
  </div>;
}
export function GuidedTour({ records, state, busy, onRun, onExit }: {
  records: Observation[]; state: LabState | null; busy: boolean;
  onRun: (action: string) => Promise<Observation | null>; onExit: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [lesson, setLesson] = useState(0);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [frame, setFrame] = useState(0);
  const [localError, setLocalError] = useState('');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const progress = guideProgress(records);
  const current = lessons[lesson];
  const frames = observation && current ? current.frames.map(i => observation.result.trace[i]).filter((s): s is Step => !!s) : [];
  const finished = !!observation && frame >= frames.length;
  const step = finished ? undefined : frames[frame];
  const explanation = step?.what === "CookieをAPIへ送信" && observation && !requestSession(observation.result)
    ? { title: "送れる受付番号がない", what: "ブラウザに番号のCookieがないため、今回は番号を付けずにアクセスしました。" }
    : plainStep(step);
  const confirmed = !!observation && progress.proofs[lesson]?.result.requestId === observation.result.requestId;
  const recovery = !!observation && !!observation.after && !confirmed;
  function focusQuestion() { requestAnimationFrame(() => heading.current?.focus()); }
  async function start() {
    if (pending.current) return;
    pending.current = true;
    const result = await onRun('lab/reset');
    pending.current = false;
    if (result?.after) {
      setStarted(true); setLesson(0); setObservation(null); setFrame(0); setLocalError(''); focusQuestion();
    }
  }
  async function execute() {
    if (!current || pending.current) return;
    pending.current = true;
    const result = await onRun(current.action);
    pending.current = false;
    setLocalError(result ? '' : '通信できませんでした。接続を確認して、同じボタンでもう一度試してください。');
    if (result) { setObservation(result); setFrame(0); }
  }
  function next() {
    if (!finished) { setFrame(frame + 1); return; }
    setLesson(lesson + 1); setObservation(null); setFrame(0); focusQuestion();
  }
  return <section className="focused-learning" aria-label="5分のガイド付き体験">
    <div className="lesson-progress"><span>目安5分 · 順番に学ぶ</span><span className="tour-count">{started ? `${progress.completed} / 4 確認できた` : '4つの問い'}</span></div>
    <div className="lesson-progress-track" aria-hidden="true">{lessons.map((_, i) => <span key={i} className={started && i < progress.completed ? 'done' : started && i === lesson ? 'current' : ''} />)}</div>
    {!started ? <div className="lesson-card lesson-welcome">
      <span className="eyebrow">SESSION AUTHENTICATION</span>
      <h2 ref={heading} tabIndex={-1}>なぜ、ログインは<br />一度でいいの？</h2>
      <p>実際にログインして、ブラウザとサーバーの間で<br className="desktop-break" />何が起きるかを、ひとつずつ確かめます。</p>
      <LessonDiagram />
      <button className="button primary lesson-primary" disabled={busy || !state} onClick={() => void start()}>5分ガイドを始める <ArrowRight size={18} /></button>
      <small className="lesson-note">開始すると、この学習空間のSessionと実行記録を初期化します。デモユーザーは残ります。</small>
    </div> : !current ? <div className="lesson-card lesson-complete">
      <CheckCircle2 size={40} /><span className="eyebrow">4つの実験を確認できました</span>
      <h2 ref={heading} tabIndex={-1}>ログインの続きは、番号で。</h2>
      <p>最初はパスワードで本人確認。次からは、ブラウザが送る番号をサーバーが調べます。</p>
      <ol><li>ログイン：番号と対応表を保存</li><li>次のアクセス：同じ番号で本人確認</li><li>ログアウト：番号と対応表を削除</li><li>その後のアクセス：本人確認できず拒否</li></ol>
      <div className="lesson-reflection"><strong>自分の言葉で説明してみましょう</strong><p>ブラウザに番号があっても、DBの記録が期限切れなら、使えるでしょうか？</p><details><summary>説明の例を見る</summary><p>使えません。サーバーは番号を受け取るたびに、対応する記録と有効期限も確認するからです。</p></details></div>
      <button className="button primary lesson-primary" onClick={onExit}>自由に実験する <ArrowRight size={18} /></button>
      <small className="lesson-note">実行結果を確認しました。理解そのものを自動判定するものではありません。</small>
    </div> : <div className="lesson-card" aria-busy={busy}>
      <span className="eyebrow">問い {lesson + 1} / 4</span>
      <h2 ref={heading} tabIndex={-1}>{current.question}</h2>
      <p className="lesson-intro">{current.intro}</p>
      <LessonDiagram step={step} />
      <div className="lesson-explanation" aria-live="polite">
        {!observation ? <p>{lesson === 0 ? '学習用のメールアドレスとパスワードは入力済みです。' : '下のボタンで、実際にアクセスして確かめます。'}</p>
          : !observation.after ? <><strong>操作後の確認ができませんでした</strong><p>結果の判定は保留です。同じ操作をもう一度試せます。</p></>
          : recovery ? <><strong>想定した結果を確認できませんでした</strong><p>番号の期限が切れた可能性があります。最初からやり直して確認しましょう。</p></>
          : finished ? <><strong className="lesson-answer"><CheckCircle2 size={20} />確かめられたこと</strong><p>{current.answer}</p>
            {(lesson === 0 || lesson === 2) && <CompactChanges observation={observation} />}
            {lesson === 1 && <p className="lesson-reused">使った番号：<code>{shortId(progress.id)}</code> · 取得成功（200）</p>}
            {lesson === 3 && <p className="lesson-reused">送った番号：なし · 取得拒否（401）</p>}
          </> : <><span className="lesson-frame">実行した処理の要点 {frame + 1} / {frames.length}</span><h3>{explanation?.title}</h3><p>{explanation?.what}</p></>}
      </div>
      {localError && <p role="alert" className="notice error">{localError}</p>}
      <div className="lesson-controls">
        {observation && confirmed && frame > 0 && <button className="text-button lesson-back" onClick={() => setFrame(frame - 1)}>ひとつ戻る</button>}
        <button className="button primary lesson-primary" disabled={busy || !state} onClick={() => {
          if (recovery) void start();
          else if (!observation || !observation.after) void execute();
          else next();
        }}>{busy ? '実行・確認中…' : recovery ? '最初からやり直す' : !observation || !observation.after ? current.button : !finished ? '次へ' : lesson === 3 ? '学んだことを振り返る' : '次の問いへ'}<ArrowRight size={18} /></button>
      </div>
      {observation && <>
        <small className="lesson-note">操作は実行済みです。「次へ」はその記録を読み進めます。</small>
        <details className="lesson-details" key={observation.result.requestId}>
          <summary>詳しい記録を見る（通信・処理・保存内容）</summary>
          <p>この1回の操作の記録です。図では主な処理を抜粋しています。ブラウザ内の動きは説明モデルで、Cookieの保存・削除は操作後の確認通信で検証します。</p>
          <ol>{observation.result.trace.map(s => <li key={s.id}><strong>{plainStep(s)?.title}</strong><small>{s.what} · {s.evidence === 'server' ? 'サーバーの実行記録' : 'ブラウザ動作の説明'}</small></li>)}</ol>
          <HttpView runs={[observation.result]} />
          {observation.after && <CompactChanges observation={observation} />}
          <p>この操作直後の受信Cookie：<code>{observation.after?.cookie?.value ?? (observation.after ? 'なし' : '未確認')}</code></p>
          <p>この操作直後のDBの番号：<code>{observation.after?.snapshot.sessions.map(s => s.id).join(', ') || (observation.after ? 'なし' : '未確認')}</code></p>
        </details>
      </>}
    </div>}
    <p className="lesson-bottom-note">再読み込みで画面の進み具合はリセットされます。</p>
  </section>;
}
