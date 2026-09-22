'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { tokenLessons, confirmsTokens } from '@/lib/tokens-learning';
import { initializeTokens, runTokens } from '@/lib/tokens-client';
import { emptyTokensMemory, type TokensAction, type TokensMemory, type TokensObservation } from '@/lib/tokens-types';
import { TokensEvidence, TokensRecord, tokensOutcome } from './tokens-evidence';
import './tokens.css';

function ExpiryWait({ expires, onReady }: { expires: string; onReady: (ready: boolean) => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(expires) - Date.now()) / 1000));
      setSeconds(remaining);
      onReady(remaining === 0);
    };
    tick(); const timer = setInterval(tick, 500); return () => clearInterval(timer);
  }, [expires, onReady]);
  return <p className="tokens-wait">{seconds === null ? '期限を確認しています…' : seconds > 0 ? `同じAccess Tokenを保持して待っています。残り約${seconds}秒。` : '期限の時刻になりました。APIへ送って確かめましょう。'}<small>端末時計による目安です。拒否の最終判断は実APIのサーバー時計で行います。</small></p>;
}

export function TokensLab() {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
  const [mode, setMode] = useState<'guided' | 'free'>('guided'), [detailed, setDetailed] = useState(false);
  const [started, setStarted] = useState(false), [index, setIndex] = useState(0), [prediction, setPrediction] = useState<number | null>(null);
  const [memory, setMemory] = useState<TokensMemory>(emptyTokensMemory);
  const [observation, setObservation] = useState<TokensObservation | null>(null), [previous, setPrevious] = useState<TokensObservation>();
  const [history, setHistory] = useState<TokensObservation[]>([]), [frame, setFrame] = useState(0);
  const [expired, setExpired] = useState(false), [ttl, setTtl] = useState<15 | 300>(300);
  const pending = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const lesson = tokenLessons[index], result = observation?.result;
  const confirmed = !!observation && confirmsTokens(observation, previous);
  const finished = !!result && frame >= result.trace.length, step = result?.trace[frame];

  async function initialize() {
    setError('');
    try { await initializeTokens(); setReady(true); }
    catch { setError('学習空間の準備に失敗しました。再試行してください。'); }
  }
  useEffect(() => { void initialize(); }, []);
  function focus() { requestAnimationFrame(() => heading.current?.focus()); }
  function start() {
    setStarted(true); setIndex(0); setPrediction(null); setObservation(null); setPrevious(undefined); setFrame(0); setError(''); setExpired(false); focus();
  }
  function switchMode(next: 'guided' | 'free') {
    setMode(next); setObservation(null); setFrame(0);
    if (next === 'guided') setStarted(false);
  }
  async function run(action: TokensAction) {
    if (pending.current || (uncertain && action !== 'issue')) return;
    pending.current = true; setBusy(true); setError(''); setObservation(null); setFrame(0);
    try {
      const o = await runTokens(action, memory, mode === 'guided' ? 15 : ttl);
      setObservation(o); setMemory(o.after); setHistory(h => [...h, o]); setUncertain(false);
    } catch {
      setUncertain(true);
      setError(`操作結果を確認できません。更新済みの可能性があるため、同じRefreshは自動再送しません。「${mode === 'guided' ? '発行からやり直す' : '2種類を発行'}」で別系列を用意してください。`);
    } finally { pending.current = false; setBusy(false); }
  }
  function next() {
    if (!finished) { setFrame(frame + 1); return; }
    if (!confirmed) return;
    setPrevious(observation!); setIndex(index + 1); setPrediction(null); setObservation(null); setFrame(0); focus();
  }
  const resultView = observation && result && <>
    <div className="tokens-outcome" role="status"><span>実際の結果</span><strong>{tokensOutcome(result)}</strong>{detailed && <small>HTTP {result.status} · {result.code} · {result.http.method} {result.http.path}</small>}</div>
    <TokensEvidence observation={observation} frame={frame} detailed={detailed} />
  </>;
  const walkthrough = result && <div className="tokens-explanation" aria-live="polite">
    {step ? <><span className="eyebrow">証拠をたどる · 記録 {frame + 1} / {result.trace.length}</span><h3>{step.title}</h3><p>{step.why}</p>{detailed && <p>{step.detail}</p>}<small>実サーバーの処理記録を要約。操作はすでに実行済みです。</small></> : <><strong>{mode === 'free' ? 'この操作で分かったこと' : prediction === lesson?.choices.length ? '見えてきたこと' : prediction === lesson?.correct ? '予想と一致しました' : '予想との違いを見てみましょう'}</strong>
      {mode === 'guided' && <small>あなたの予想：{prediction === lesson?.choices.length ? 'まだわからない' : lesson?.choices[prediction ?? 0]}</small>}
      <p>{mode === 'free' ? result.message : lesson?.answer}</p></>}
  </div>;
  return <div className="page tokens-lab">
    <div className="page-heading"><div><span className="eyebrow">PHASE 09 · ACCESS / REFRESH TOKEN</span><h1>短く使う。必要なら更新する。</h1><p>2つの期限と、更新を止める場所を実験します。</p></div></div>
    <div className="tokens-toolbar"><div role="group" aria-label="学び方"><button disabled={busy} aria-pressed={mode === 'guided'} onClick={() => switchMode('guided')}>順番に学ぶ</button><button disabled={busy} aria-pressed={mode === 'free'} onClick={() => switchMode('free')}>自由に実験する</button></div><div role="group" aria-label="説明の詳しさ"><button aria-pressed={!detailed} onClick={() => setDetailed(false)}>やさしく</button><button aria-pressed={detailed} onClick={() => setDetailed(true)}>詳しく</button></div></div>
    {error && <div className="notice error" role="alert"><p>{error}</p>{!ready && <button onClick={() => void initialize()}>準備を再試行</button>}</div>}
    {mode === 'guided' ? <section className="tokens-focused" aria-label="AccessとRefreshのガイド"><div className="tokens-progress"><span>{started ? '予想 → 実測 → 証拠 → 理由' : '目安10分 · 1画面1問'}</span><span>{started ? `${Math.min(index + 1, tokenLessons.length)} / ${tokenLessons.length} 問` : '実験8問'}</span></div>
      {!started ? <div className="lesson-card tokens-welcome"><span className="eyebrow">TWO TOKENS, TWO JOBS</span><h2 ref={heading} tabIndex={-1}>期限を短くすると、<br />何度もログインが必要？</h2><p>使うための値と、更新するための値。<br />実際に期限を待ち、入れ替え、古い値も送ります。</p><div className="tokens-pair-intro"><span>Access Token<strong>APIを使う</strong></span><span>Refresh Token<strong>新しいトークンを受け取る</strong></span></div><button className="button primary" disabled={!ready || busy} onClick={start}>更新ガイドを始める <ArrowRight size={18} /></button><small>Session認証は変えません。最初の操作で新しい更新系列を作ります。</small></div>
        : !lesson ? <div className="lesson-card tokens-welcome"><CheckCircle2 size={36} /><h2 ref={heading} tabIndex={-1}>更新を止めることと、今止めること。</h2><p>短命なAccessと、更新を管理するRefreshを実測しました。採点はありません。</p><label htmlFor="tokens-reflection">「Refreshを停止した。だからAPIにも即座にアクセスできない」と言えるでしょうか？</label><textarea id="tokens-reflection" placeholder="どこが何を確認するか、自分の言葉で書いてみる（任意・画面内のみ）" /><button className="button primary" onClick={() => switchMode('free')}>自由に実験する <ArrowRight size={18} /></button><Link className="text-button" href="/compare">PHASE 8で失効の設計を見返す</Link></div>
          : <div className="lesson-card" aria-busy={busy}><span className="eyebrow">実際に操作する · 問い {index + 1}</span><h2 ref={heading} tabIndex={-1}>{lesson.question}</h2>
            {!observation && <><p>{lesson.intro}</p><fieldset className="prediction-choices"><legend>どうなると思いますか？</legend>{[...lesson.choices, 'まだわからない'].map((choice, i) => <label key={choice}><input type="radio" name="token-prediction" checked={prediction === i} disabled={busy} onChange={() => setPrediction(i)} /><span>{choice}</span></label>)}<small>点数は付けません。予想が外れても進めます。</small></fieldset>
              {lesson.action === 'expired-access' && memory.pair && <ExpiryWait expires={memory.pair.accessExpiresAt} onReady={setExpired} />}</>}
            {resultView}
            {observation && !confirmed ? <div className="tokens-explanation" role="status"><strong>この問いの比較は、まだ確認できません</strong><p>{result?.code === 'expired' ? 'Access Tokenの期限が切れています。発行からやり直して、期限内の結果を比べてください。' : '送った値・拒否理由・DBの変化が、この問いの条件と一致しません。実際の結果は上に表示しています。'}</p></div> : walkthrough}
            <div className="tokens-controls">{observation && frame > 0 && <button className="text-button" onClick={() => setFrame(frame - 1)}>ひとつ戻る</button>}<button className="button primary" disabled={busy || !ready || (!observation && (prediction === null || (uncertain && lesson.action !== 'issue') || (lesson.action === 'expired-access' && !expired)))} onClick={() => observation && confirmed ? next() : void run(lesson.action)}>{busy ? '実行・確認中…' : observation && confirmed ? finished ? index === tokenLessons.length - 1 ? '学んだことを振り返る' : '次の問いへ' : '記録の次へ' : lesson.button}<ArrowRight size={18} /></button></div>
            {(uncertain || (observation && !confirmed)) && <button className="text-button" disabled={busy} onClick={start}>発行からやり直す</button>}
            {observation && <TokensRecord observation={observation} />}
          </div>}
    </section> : <section className="tokens-focused" aria-label="AccessとRefreshの自由実験"><div className="lesson-card"><h2>期限・更新・停止を試す</h2><p>現在保持：{memory.pair ? `第${memory.pair.generation}世代のRefreshとAccess` : 'なし'} ／ 使用済みRefreshのコピー：{memory.oldRefresh ? 'あり' : 'なし'}</p><label>発行するAccessの期限 <select value={ttl} disabled={busy} onChange={e => setTtl(Number(e.target.value) as 15 | 300)}><option value={300}>5分</option><option value={15}>15秒（実験用）</option></select></label>
      <div className="tokens-actions">{([['issue', '2種類を発行'], ['profile', 'AccessでProfile'], ['wrong-target', 'RefreshでProfile'], ['refresh', '最新Refreshで更新'], ['reuse', '古いRefreshを再送'], ['revoke', 'この系列の更新を停止'], ['expire', 'DBの更新期限を過去にする']] as [TokensAction, string][]).map(([action, label]) => <button className="button" key={action} disabled={busy || !ready || (action !== 'issue' && (!memory.pair || uncertain)) || (action === 'reuse' && !memory.oldRefresh)} onClick={() => void run(action)}>{label}</button>)}</div>
      <p className="tokens-caption">更新後のAccessは5分。Refreshは初回発行から30分で延長なし。発行するたび別系列になります。停止・DB期限変更は現在の系列だけに作用し、ブラウザのコピーは実験用に残します。</p>
      {history.length > 0 && <label>過去の操作<select value={result?.requestId ?? ''} disabled={busy} onChange={e => { setObservation(history.find(h => h.result.requestId === e.target.value) ?? null); setFrame(0); }}><option value="">選んで見返す</option>{history.map((h, i) => <option key={h.result.requestId} value={h.result.requestId}>{i + 1}. {h.result.operation} · {h.result.status} · {h.result.code}</option>)}</select></label>}
    </div>{observation && <div className="lesson-card"><h2>選んだ操作の記録</h2><p className="tokens-caption">履歴を選んでも、現在の保持トークンやDBは戻りません。</p>{resultView}{walkthrough}<div className="tokens-controls"><button disabled={frame === 0} onClick={() => setFrame(frame - 1)}>ひとつ戻る</button><button disabled={finished} onClick={() => setFrame(frame + 1)}>記録の次へ</button></div><TokensRecord observation={observation} /></div>}</section>}
    <p className="tokens-footer">ローカル教材専用です。2種類の値は画面内メモリーで保持し、Cookieや永続ストレージには保存しません。実際のサービス向けの保存方式の推奨ではありません。OAuthの認可・同意・クライアント連携は次のPHASEで扱います。</p>
  </div>;
}
