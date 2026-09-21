'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { compareLessons, confirmsComparison } from '@/lib/compare-learning';
import { compareState, executeComparison } from '@/lib/compare-client';
import { emptyCompareMemory, type CompareAction, type CompareDraft, type CompareMemory, type CompareObservation } from '@/lib/compare-types';
import { CompareDiagram } from './compare-diagram';
import { CompareModel } from './compare-model';
import './compare.css';

function CompareRecord({ observation: o }: { observation: CompareObservation }) {
  return <details className="compare-record"><summary>詳しい記録を見る（送信値・通信・DB前後）</summary>
    <p>実際の記録の抜粋。Cookieは観察APIに届いた値から確認し、HttpOnly CookieをJavaScriptで読んでいません。パスワードは伏せています。</p>
    <p>Sessionのコピー再送はJSON本文で行います。ブラウザの認証Cookieを復活させる操作ではありません。</p>
    <p>操作前の観測：{o.before.serverTime}／操作後の観測：{o.after.serverTime}</p>
    <pre>{JSON.stringify({ session: o.session?.http ?? o.replay?.http, jwt: o.jwt?.http, sessionReplayReason: o.replay?.code, jwtReason: o.jwt?.code, cookieBefore: o.before.cookie, cookieAfter: o.after.cookie, sessionsBefore: o.before.snapshot.sessions, sessionsAfter: o.after.snapshot.sessions, memoryBefore: o.memoryBefore, memoryAfter: o.memoryAfter }, null, 2)}</pre>
    <p>JWTのexpはAccess Tokenの期限。SessionのDB・Cookie期限とは別です。JWTごとの状態は保存しませんが、学習空間確認と観察用SQLは実行します。</p>
  </details>;
}

export function CompareLab() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [detailed, setDetailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [memory, setMemory] = useState<CompareMemory>(emptyCompareMemory);
  const [observation, setObservation] = useState<CompareObservation | null>(null);
  const [previous, setPrevious] = useState<CompareObservation | undefined>();
  const [history, setHistory] = useState<CompareObservation[]>([]);
  const [frame, setFrame] = useState(0);
  const [modelOpen, setModelOpen] = useState(false);
  const pending = useRef(false);
  const awaitingObservation = useRef<CompareDraft | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lesson = compareLessons[index];
  const isModel = lesson?.action === 'revocation' || lesson?.action === 'scale';
  const confirmed = !!observation && confirmsComparison(observation, previous);
  const finished = !!observation && frame >= observation.steps.length;
  const step = observation?.steps[frame];
  const answered = observation !== null || modelOpen;

  async function initialize() {
    setError('');
    try { await compareState(true); setReady(true); }
    catch { setError('学習空間の準備に失敗しました。準備を再試行してください。'); }
  }
  useEffect(() => { void initialize(); }, []);
  function focus() { requestAnimationFrame(() => heading.current?.focus()); }
  function start() {
    setStarted(true); setIndex(0); setPrediction(null); setObservation(null); setPrevious(undefined); setFrame(0); setModelOpen(false); setError(''); awaitingObservation.current = null; focus();
  }
  function switchMode(next: 'guided' | 'free') {
    setMode(next); setObservation(null); setFrame(0); setError(''); awaitingObservation.current = null;
    if (next === 'guided') setStarted(false);
  }
  async function run(action: CompareAction) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const draft = awaitingObservation.current ?? await executeComparison(action, memory, setMemory);
      awaitingObservation.current = draft;
      const after = await compareState();
      const result = { ...draft, after };
      setObservation(result); setFrame(0); setHistory(h => [...h, result]); awaitingObservation.current = null;
    } catch (e) {
      setObservation(null); setFrame(0);
      setError(`${e instanceof Error ? e.message : '通信に失敗しました。'} ${awaitingObservation.current ? '操作は実行済みです。再試行では観測だけを取得します。' : '一部の操作が実行済みの場合があります。判定は保留します。'}`);
    } finally { pending.current = false; setBusy(false); }
  }
  function next() {
    if (observation && !finished) { setFrame(frame + 1); return; }
    if (!modelOpen && !confirmed) return;
    if (observation) setPrevious(observation);
    setIndex(index + 1); setPrediction(null); setObservation(null); setFrame(0); setModelOpen(false); focus();
  }
  const feedback = <><strong>{prediction === lesson?.choices.length ? '見えてきたこと' : prediction === lesson?.correct ? '予想と一致しました' : '予想との違いを見てみましょう'}</strong><small>あなたの予想：{prediction === lesson?.choices.length ? 'まだわからない' : lesson?.choices[prediction ?? 0]}</small><p>{lesson?.answer}</p></>;
  const status = observation && <p className="compare-verdict">{observation.session && `Session HTTP ${observation.session.http.status}`}{observation.replay && `Session HTTP ${observation.replay.status}（${observation.replay.code}）`}{observation.jwt && ` ／ JWT HTTP ${observation.jwt.status}（${observation.jwt.code}）`}{observation.action === 'logout' && ' ／ JWT：画面内の保持を解除（HTTP通信なし）'}</p>;
  return <div className="page compare-lab">
    <div className="page-heading"><div><span className="eyebrow">PHASE 08 · SESSION vs JWT</span><h1>ログアウトした。そのコピーは？</h1><p>保存場所の違いから、失効と増設の判断へ。</p></div></div>
    <div className="compare-toolbar"><div role="group" aria-label="学び方"><button disabled={busy} aria-pressed={mode === 'guided'} onClick={() => switchMode('guided')}>順番に学ぶ</button><button disabled={busy} aria-pressed={mode === 'free'} onClick={() => switchMode('free')}>自由に実験する</button></div><div role="group" aria-label="説明の詳しさ"><button aria-pressed={!detailed} onClick={() => setDetailed(false)}>やさしく</button><button aria-pressed={detailed} onClick={() => setDetailed(true)}>詳しく</button></div></div>
    {error && <p role="alert" className="notice error">{error}{!ready && <button onClick={() => void initialize()}>準備を再試行</button>}</p>}
    {mode === 'guided' ? <section className="compare-focused" aria-label="SessionとJWTの比較ガイド">
      <div className="compare-progress"><span>{started ? isModel ? '設計を考える · 説明モデル' : '予想して操作する · 実測' : '目安8分 · 1画面1問'}</span><span>{started ? `${Math.min(index + 1, 6)} / 6 問` : '実験4問 ＋ 設計2問'}</span></div>
      {!started ? <div className="lesson-card compare-welcome"><span className="eyebrow">WHERE DOES VALIDITY LIVE?</span><h2 ref={heading} tabIndex={-1}>「手放す」と「使えなくする」は、<br />同じでしょうか。</h2><p>同じ利用者でSessionとJWTを発行し、<br />ログアウト前後に同じ値を送って比べます。</p><div className="compare-welcome-pair"><span>Session<br /><strong>サーバーが対応を覚える</strong></span><span>JWT<br /><strong>トークンが署名付きで語る</strong></span></div><button className="button primary" disabled={!ready || busy} onClick={start}>比較ガイドを始める <ArrowRight size={18} /></button><small>開始ボタンでは認証状態を変えません。最初の実験で現在のSessionを置き換えます。</small></div>
        : !lesson ? <div className="lesson-card compare-complete"><CheckCircle2 size={36} /><h2 ref={heading} tabIndex={-1}>失効を、どこで判断するか。</h2><p>実験と説明モデルを最後まで確認しました。理解の採点ではありません。</p><label htmlFor="compare-reflection">自分の言葉で：「退職者のアクセスをすぐ止めたい」なら、どこに何を確認させる？</label><textarea id="compare-reflection" placeholder="どちらを選ぶかと、そのために必要な仕組みを書いてみる（任意・この画面内のみ）" /><button className="button primary" onClick={() => switchMode('free')}>自由に実験する <ArrowRight size={18} /></button><Link className="text-button" href="/jwt">JWT編で署名と期限を見返す</Link></div>
          : <div className="lesson-card" aria-busy={busy}><span className="eyebrow">{isModel ? '説明モデル' : '実際に操作する'} · 問い {index + 1}</span><h2 ref={heading} tabIndex={-1}>{lesson.question}</h2>
            {!answered && <p>{lesson.intro}</p>}
            {!answered && <fieldset className="prediction-choices"><legend>どうなると思いますか？</legend>{[...lesson.choices, 'まだわからない'].map((choice, i) => <label key={choice}><input type="radio" name="compare-prediction" disabled={busy} checked={prediction === i} onChange={() => setPrediction(i)} /><span>{choice}</span></label>)}<small>点数は付けません。予想が外れても進めます。</small></fieldset>}
            {observation && <CompareDiagram observation={observation} frame={frame} />}
            {modelOpen && (lesson.action === 'revocation' || lesson.action === 'scale') && <CompareModel key={lesson.action} kind={lesson.action} />}
            {answered && <div className="compare-explanation" aria-live="polite">{observation && !confirmed ? <><strong>想定した比較を確認できませんでした</strong><p>{observation.jwt?.code === 'expired' ? 'JWTの期限が切れています。発行からやり直すと、期限内の再送を比較できます。' : '送信値・Cookie・DBの変化・拒否理由が、この問いの条件と一致しません。'} この結果では確認済みにしません。</p>{status}</> : modelOpen || finished ? <>{feedback}{status}</> : <><span className="eyebrow">実行記録 {frame + 1} / {observation?.steps.length}</span><h3>{step?.title}</h3><p>{step?.text}</p>{detailed && <p>{step?.detail}</p>}<small>{step?.source === 'server' ? 'サーバー実行記録の要約' : 'ブラウザで実行した記録'}</small></>}</div>}
            <div className="compare-controls">{observation && confirmed && frame > 0 && <button className="text-button" onClick={() => setFrame(frame - 1)}>ひとつ戻る</button>}<button className="button primary" disabled={busy || !ready || (!answered && prediction === null)} onClick={() => !answered || (observation && !confirmed) ? isModel ? setModelOpen(true) : void run(lesson.action as CompareAction) : next()}>{busy ? '実行・確認中…' : !answered ? awaitingObservation.current ? '観測を再試行する' : lesson.button : observation && !confirmed ? '同じ実験を再試行' : observation && !finished ? '次へ' : index === compareLessons.length - 1 ? '学んだことを振り返る' : '次の問いへ'}<ArrowRight size={18} /></button></div>
            {(error || (observation && !confirmed)) && <button className="text-button" disabled={busy} onClick={start}>発行からやり直す</button>}
            {observation && <><small className="compare-note">操作は実行済みです。「次へ」は記録を読み進めます。</small><CompareRecord observation={observation} /></>}
          </div>}
    </section> : <section className="compare-free" aria-label="比較の自由実験"><div className="lesson-card"><h2>コピーを残して、繰り返し確かめる</h2><p>通常利用用JWT：{memory.activeJwt ? 'あり' : 'なし'} ／ 実験用コピー：{memory.copy ? 'Session・JWTあり' : 'なし'}</p><p>発行すると現在のSessionを置き換えます。Cookie・DB・コピーの違いは操作記録で確認できます。</p><div className="compare-actions">{([['prepare', '両方を発行'], ['access', '両方でアクセス'], ['logout', '両方をログアウト'], ['replay', 'コピーを再送']] as const).map(([action, label]) => <button className="button" key={action} disabled={busy || !ready || (action !== 'prepare' && !memory.copy) || (!!awaitingObservation.current && awaitingObservation.current.action !== action) || ((action === 'access' || action === 'logout') && !memory.activeJwt && !awaitingObservation.current)} onClick={() => void run(action)}>{label}</button>)}</div>
      {history.length > 0 && <label>過去の操作<select value={observation?.id ?? ''} disabled={busy} onChange={e => { setObservation(history.find(h => h.id === e.target.value) ?? null); setFrame(0); }}><option value="">選んで見返す</option>{history.map((h, i) => <option key={h.id} value={h.id}>{i + 1}. {compareLessons.find(l => l.action === h.action)?.button} · Session {h.session?.http.status ?? h.replay?.status} / JWT {h.jwt?.status ?? '保持解除'}</option>)}</select></label>}
    </div>{observation && <div className="lesson-card"><h2>選んだ操作の記録</h2><p>記録を見返しても、現在のCookie・DB・保持JWTは戻りません。</p><CompareDiagram observation={observation} frame={frame} /><div className="compare-explanation"><h3>{finished ? 'この操作の結果' : step?.title}</h3><p>{finished ? '詳細記録で送信値と状態を確認できます。' : step?.text}</p>{detailed && !finished && <p>{step?.detail}</p>}{status}</div><div className="compare-actions"><button disabled={frame === 0} onClick={() => setFrame(frame - 1)}>ひとつ戻る</button><button disabled={finished} onClick={() => setFrame(frame + 1)}>記録の次へ</button></div><CompareRecord observation={observation} /></div>}</section>}
    <p className="compare-footer">この比較は本教材の構成についての結果です。JWTでも失効管理を追加できます。Sessionも共有ストアで増設できます。方式・保存手段・失効方針を分けて考えます。コピーと履歴は再読み込みで消えます。</p>
  </div>;
}
