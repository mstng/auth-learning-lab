'use client';
import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { LabState, Step } from '@/lib/types';
import { requestSession, shortId, type Observation } from '@/lib/learning';
import { plainStep } from '@/lib/plain-language';
import { HttpView } from './inspectors';
import { LessonDiagram } from './lesson-diagram';
import { confirmsLesson, courses, type Course, type TourAction } from '@/lib/tour-lessons';

function CompactChanges({ observation, expiry = false }: { observation: Observation; expiry?: boolean }) {
  const { before, after } = observation;
  if (!after) return null;
  const id = before.cookie?.value;
  const beforeRow = before.snapshot.sessions.find(s => s.id === id);
  const afterRow = after.snapshot.sessions.find(s => s.id === (after.cookie?.value ?? id));
  return <div className="lesson-comparison" aria-label="この操作の変更前と変更後">
    <table><thead><tr><th scope="col">保存場所</th><th scope="col">変更前</th><th scope="col">変更後</th></tr></thead>
      <tbody><tr><th scope="row">ブラウザの番号</th><td><code>{shortId(before.cookie?.value)}</code></td><td><code>{shortId(after.cookie?.value)}</code></td></tr>
        <tr><th scope="row">DBの対応表</th><td>{before.snapshot.sessions.length}件</td><td>{after.snapshot.sessions.length}件</td></tr>
        {expiry && <tr><th scope="row">DBの期限</th><td>{!beforeRow ? "記録なし" : Date.parse(beforeRow.expires_at) <= Date.parse(before.serverTime) ? "期限切れ" : "期限内"}</td><td>{!afterRow ? "記録なし" : Date.parse(afterRow.expires_at) <= Date.parse(after.serverTime) ? "期限切れ" : "期限内"}</td></tr>}</tbody>
    </table>
  </div>;
}
export function GuidedTour({ state, busy, onRun, onExit }: {
  state: LabState | null; busy: boolean;
  onRun: (action: TourAction) => Promise<Observation | null>; onExit: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [course, setCourse] = useState<Course>('basic');
  const [proofs, setProofs] = useState<(Observation | null)[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [lesson, setLesson] = useState(0);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [frame, setFrame] = useState(0);
  const [localError, setLocalError] = useState('');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const lessons = courses[course].lessons;
  const completed = proofs.filter(Boolean).length;
  const current = lessons[lesson];
  const frames = observation && current ? current.frames.map(i => observation.result.trace[i]).filter((s): s is Step => !!s) : [];
  const finished = !!observation && frame >= frames.length;
  const step = finished ? undefined : frames[frame];
  const explanation = step?.what === "CookieをAPIへ送信" && observation && !requestSession(observation.result)
    ? { title: "送れる受付番号がない", what: "ブラウザに番号のCookieがないため、今回は番号を付けずにアクセスしました。" }
    : plainStep(step);
  const confirmed = !!observation && proofs[lesson]?.result.requestId === observation.result.requestId;
  const recovery = !!observation && !!observation.after && !confirmed;
  function focusQuestion() { requestAnimationFrame(() => heading.current?.focus()); }
  async function start(nextCourse: Course = course) {
    if (pending.current) return;
    pending.current = true;
    const result = await onRun('lab/reset');
    pending.current = false;
    if (result?.after) {
      setStarted(true); setCourse(nextCourse); setProofs([]); setPrediction(null); setLesson(0); setObservation(null); setFrame(0); setLocalError(''); focusQuestion();
    }
  }
  async function execute() {
    if (!current || prediction === null || pending.current) return;
    pending.current = true;
    const result = await onRun(current.action);
    pending.current = false;
    setLocalError(result ? '' : '通信できませんでした。接続を確認して、同じボタンでもう一度試してください。');
    if (result) {
      setObservation(result); setFrame(0);
      if (confirmsLesson(course, lesson, result, proofs[lesson - 1] ?? undefined)) {
        setProofs(previous => { const updated = [...previous]; updated[lesson] = result; return updated; });
      }
    }
  }
  function next() {
    if (!finished) { setFrame(frame + 1); return; }
    setLesson(lesson + 1); setPrediction(null); setObservation(null); setFrame(0); focusQuestion();
  }
  return <section className="focused-learning" aria-label="5分のガイド付き体験">
    <div className="lesson-progress"><span>{started ? courses[course].name : "目安5分 · 順番に学ぶ"}</span><span className="tour-count">{started ? `${completed} / ${lessons.length} 確認できた` : '4つの問い'}</span></div>
    <div className="lesson-progress-track" aria-hidden="true">{lessons.map((_, i) => <span key={i} className={started && i < completed ? 'done' : started && i === lesson ? 'current' : ''} />)}</div>
    {!started ? <div className="lesson-card lesson-welcome">
      <span className="eyebrow">SESSION AUTHENTICATION</span>
      <h2 ref={heading} tabIndex={-1}>なぜ、ログインは<br />一度でいいの？</h2>
      <p>実際にログインして、ブラウザとサーバーの間で<br className="desktop-break" />何が起きるかを、ひとつずつ確かめます。</p>
      <LessonDiagram />
      <button className="button primary lesson-primary" disabled={busy || !state} onClick={() => void start("basic")}>5分ガイドを始める <ArrowRight size={18} /></button>
      <button className="text-button failure-entry" disabled={busy || !state} onClick={() => void start("failure")}>失敗する実験から始める</button>
      <small className="lesson-note">どちらのガイドも、開始すると、この学習空間のSessionと実行記録を初期化します。デモユーザーは残ります。</small>
    </div> : !current ? <div className="lesson-card lesson-complete">
      <CheckCircle2 size={40} /><span className="eyebrow">{lessons.length}つの実験を確認できました</span>
      <h2 ref={heading} tabIndex={-1}>{course === 'basic' ? 'ログインの続きは、番号で。' : '番号があることと、使えることは別。'}</h2>
      <p>{course === 'basic' ? '最初はパスワードで本人確認。次からは、ブラウザが送る番号をサーバーが調べます。' : '間違ったパスワードでは番号を作らず、期限切れの番号では利用を断る。どちらも正しい認証の動きです。'}</p>
      {course === 'basic' ? <ol><li>ログイン：番号と対応表を保存</li><li>次のアクセス：同じ番号で本人確認</li><li>ログアウト：番号と対応表を削除</li><li>その後のアクセス：本人確認できず拒否</li></ol> : <ol><li>パスワード誤り：新しい番号は作られない</li><li>正しいパスワード：番号が発行される</li><li>DBだけ期限切れ：Cookieは残る</li><li>期限切れの番号：送っても利用できない</li><li>再ログイン：新しい番号に入れ替わる</li></ol>}
      {course === 'basic' ? <><p className="failure-invitation">次は「番号が残っていても使えない」を実験できます。開始するとSessionと実行記録を初期化します。</p><button className="button primary lesson-primary" disabled={busy} onClick={() => void start('failure')}>失敗する実験へ <ArrowRight size={18} /></button><button className="text-button" onClick={onExit}>自由に実験する</button></> : <button className="button primary lesson-primary" onClick={onExit}>自由に実験する <ArrowRight size={18} /></button>}
      <small className="lesson-note">実行結果を確認しました。理解そのものを自動判定するものではありません。</small>
    </div> : <div className="lesson-card" aria-busy={busy}>
      <span className="eyebrow">問い {lesson + 1} / {lessons.length}</span>
      <h2 ref={heading} tabIndex={-1}>{current.question}</h2>
      <p className="lesson-intro" hidden={!!observation}>{current.intro}</p>
      <LessonDiagram step={step} observation={observation} state={state} finished={finished} />
      <div className="lesson-explanation" aria-live="polite">
        {!observation ? <fieldset className="prediction-choices"><legend>どうなると思いますか？</legend>{[...current.choices, 'まだわからない'].map((choice, i) => <label key={choice}><input type="radio" name="prediction" value={i} checked={prediction === i} disabled={busy} onChange={() => setPrediction(i)} /><span>{choice}</span></label>)}<small>予想を選んでから実行します。点数は付けません。</small></fieldset>
          : !observation.after ? <><strong>操作後の確認ができませんでした</strong><p>結果の判定は保留です。同じ操作をもう一度試せます。</p></>
          : recovery ? <><strong>想定した結果を確認できませんでした</strong><p>必要なCookie・DB・通信結果が揃いませんでした。途中の期限切れなどが考えられます。このガイドを最初からやり直しましょう。</p></>
          : finished ? <><div className="prediction-feedback" data-outcome={prediction === current.choices.length ? 'unknown' : prediction === current.correct ? 'match' : 'different'}><strong className="lesson-answer"><CheckCircle2 size={20} />{prediction === current.choices.length ? '実験からわかったこと' : prediction === current.correct ? '予想と一致しました' : '予想との違いを見てみましょう'}</strong><small>あなたの予想：{prediction === current.choices.length ? 'まだわからない' : current.choices[prediction ?? 0]}</small></div><p>{current.answer}</p>
            {current.comparison && <CompactChanges observation={observation} expiry={course === 'failure' && lesson >= 2} />}
            {current.action === 'profile' && <p className="lesson-reused">送った番号：<code>{shortId(requestSession(observation.result))}</code> · {observation.result.http.status === 200 ? '取得成功（200）' : '取得拒否（401）'}</p>}
          </> : <><span className="lesson-frame">実行した処理の要点 {frame + 1} / {frames.length}</span><h3>{explanation?.title}</h3><p>{explanation?.what}</p></>}
      </div>
      {localError && <p role="alert" className="notice error">{localError}</p>}
      <div className="lesson-controls">
        {observation && confirmed && frame > 0 && <button className="text-button lesson-back" onClick={() => setFrame(frame - 1)}>ひとつ戻る</button>}
        <button className="button primary lesson-primary" disabled={busy || !state || (!observation && prediction === null)} onClick={() => {
          if (recovery) void start();
          else if (!observation || !observation.after) void execute();
          else next();
        }}>{busy ? '実行・確認中…' : recovery ? '最初からやり直す' : !observation || !observation.after ? current.button : !finished ? '次へ' : lesson === lessons.length - 1 ? '学んだことを振り返る' : '次の問いへ'}<ArrowRight size={18} /></button>
      </div>
      {observation && <>
        <small className="lesson-note">操作は実行済みです。「次へ」はその記録を読み進めます。</small>
        <details className="lesson-details" key={observation.result.requestId}>
          <summary>詳しい記録を見る（通信・処理・保存内容）</summary>
          <p>この1回の操作の記録です。図では主な処理を抜粋しています。ブラウザ内の動きは説明モデルで、Cookieの保存・削除は操作後の確認通信で検証します。</p>
          <ol>{observation.result.trace.map(s => <li key={s.id}><strong>{plainStep(s)?.title}</strong><small>{s.what} · {s.evidence === 'server' ? 'サーバーの実行記録' : 'ブラウザ動作の説明'}</small></li>)}</ol>
          <HttpView runs={[observation.result]} />
          {observation.after && <CompactChanges observation={observation} expiry={course === "failure"} />}
          <p>この操作直後の受信Cookie：<code>{observation.after?.cookie?.value ?? (observation.after ? 'なし' : '未確認')}</code></p>
          <p>この操作直後のDBの番号：<code>{observation.after?.snapshot.sessions.map(s => s.id).join(', ') || (observation.after ? 'なし' : '未確認')}</code></p>
        </details>
      </>}
    </div>}
    <p className="lesson-bottom-note">再読み込みで画面の進み具合はリセットされます。</p>
  </section>;
}
