'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { jwtCourses, changeJwt, confirmsJwtLesson, readJwt, tokenLabel, type JwtAction, type JwtCourse, type JwtObservation } from '@/lib/jwt-learning';
import type { JwtResult, JwtStep } from '@/lib/jwt-types';
import { JwtParts } from './jwt-parts';
import { JwtDiagram } from './jwt-diagram';
import './jwt.css';

function browserStep(title: string, why: string, detail: string): JwtStep {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), place: 'browser', evidence: 'browser', title, why, detail };
}
export function JwtLab() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [detailed, setDetailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [course, setCourse] = useState<JwtCourse>('basic');
  const [index, setIndex] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [history, setHistory] = useState<JwtObservation[]>([]);
  const [observation, setObservation] = useState<JwtObservation | null>(null);
  const [previous, setPrevious] = useState<JwtObservation | undefined>();
  const [frame, setFrame] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [email, setEmail] = useState('sample@example.com');
  const [password, setPassword] = useState('LearnSession!2026');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const lesson = jwtCourses[course].lessons[index];
  const finished = !!observation && frame >= observation.steps.length;
  const confirmed = !!observation && !!lesson && confirmsJwtLesson(lesson.action, observation, previous);
  const step = observation?.steps[frame];
  const expiredWait = lesson?.action === 'expired' && seconds > 0;
  const selectedToken = observation?.decodedToken ?? observation?.sentToken ?? observation?.afterToken;

  async function initialize() {
    setError('');
    try {
      const r = await fetch('/api/lab/init', { method: 'POST', headers: { 'X-Lab-Request': '1', 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error('学習空間を準備できませんでした。');
      await r.json(); setReady(true);
    } catch { setError('学習空間を準備できませんでした。接続を確認して再試行してください。'); }
  }
  useEffect(() => { void initialize(); }, []);
  useEffect(() => {
    if (deadline === null) { setSeconds(0); return; }
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [deadline]);
  function focus() { requestAnimationFrame(() => heading.current?.focus()); }
  function start(next: JwtCourse) {
    setCourse(next); setIndex(0); setStarted(true); setPrediction(null); setObservation(null); setPrevious(undefined); setFrame(0); setError(''); focus();
  }
  async function execute(action: JwtAction) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const beforeToken = token;
      let afterToken = token, sentToken: string | null = null, result: JwtResult | undefined;
      const steps: JwtStep[] = [];
      if (action === 'decode') {
        if (!token) throw new Error('先にJWTを発行してください。');
        readJwt(token);
        steps.push(browserStep('ブラウザだけでJWTを分解', '中身を読むための秘密鍵は不要です。まだ本物かは検証していません。', 'jose.decodeProtectedHeader / decodeJwt。HTTP通信なし。デコードしたclaimsは未検証。'));
      } else {
        const issuing = action === 'issue' || action === 'short';
        if (!issuing && !token) throw new Error('先にJWTを発行してください。');
        if (!issuing) {
          sentToken = action === 'tamper' || action === 'none' ? changeJwt(token!, action) : token;
          if (action === 'tamper' || action === 'none') steps.push(browserStep('送信用コピーを編集', '元のJWTはそのまま残し、変更したコピーだけを送ります。', action === 'tamper' ? 'Payload.roleだけを変更。HeaderとSignatureは元のまま。' : 'Header.alg=none / Signatureを空に変更。Payloadは元のまま。'));
          steps.push(browserStep('JWTをBearerとして送信', 'この操作ではパスワードを送りません。', 'fetchのAuthorizationヘッダーにJWTを設定。サーバー受信値はHTTP記録で確認します。'));
        }
        const r = await fetch(issuing ? '/api/jwt/issue' : '/api/jwt/profile', {
          method: issuing ? 'POST' : 'GET', cache: 'no-store',
          headers: { 'X-Lab-Request': '1', ...(issuing ? { 'Content-Type': 'application/json' } : { Authorization: `Bearer ${sentToken}` }) },
          ...(issuing ? { body: JSON.stringify({ email: mode === 'guided' ? 'sample@example.com' : email, password: mode === 'guided' ? 'LearnSession!2026' : password, ttl: action === 'short' ? 15 : 300 }) } : {}),
        });
        const data = await r.json();
        if (!data.requestId || !Array.isArray(data.trace) || !data.before || !data.after || data.status !== r.status) throw new Error(data.message ?? '実行結果の観測が完了しませんでした。再試行してください。');
        result = data as JwtResult;
        if (!issuing && result.http.requestHeaders.Authorization !== `Bearer ${sentToken}`) throw new Error('送ったJWTと受信記録が一致しません。判定を保留します。');
        steps.push(...result.trace);
        if (issuing && result.token && result.status === 200) {
          afterToken = result.token; setToken(result.token);
          const { payload } = readJwt(result.token);
          setDeadline(performance.now() + Math.max(0, payload.exp! * 1000 - Date.parse(result.serverTime)) + 250);
          steps.push(browserStep('JWTを画面内メモリーに保持', '次のアクセスで使います。再読み込みすると画面内のJWTは消えます。', 'React stateに保持。Cookie / localStorage / sessionStorageには書き込んでいません。'));
        }
      }
      const o: JwtObservation = { id: crypto.randomUUID(), action, beforeToken, afterToken, sentToken, result, steps, ...(action === 'decode' ? { decodedToken: token! } : {}) };
      setObservation(o); setFrame(0); setHistory(h => [...h, o]);
    } catch (e) {
      setObservation(null); setFrame(0);
      setError(e instanceof Error ? e.message : '通信できませんでした。再試行してください。');
    } finally { pending.current = false; setBusy(false); }
  }
  function next() {
    if (!finished) { setFrame(frame + 1); return; }
    if (!confirmed) return;
    setPrevious(observation!); setIndex(index + 1); setObservation(null); setFrame(0); setPrediction(null); focus();
  }
  function switchMode(nextMode: 'guided' | 'free') {
    setMode(nextMode); setObservation(null); setFrame(0); setError('');
    if (nextMode === 'guided') setStarted(false);
  }
  const details = observation && <details className="jwt-record" key={observation.id}>
    <summary>詳しい記録を見る（通信・保存・公開鍵）</summary>
    <p>過去の実行記録です。再生してもAPIは再実行されず、今のJWTやDBは巻き戻りません。</p>
    <ol>{observation.steps.map((s, i) => <li key={s.id}><button onClick={() => setFrame(i)}>{i + 1}. {s.title}</button><small>{s.evidence === 'server' ? 'サーバー実行記録' : 'ブラウザ実行記録'} · {s.at}</small></li>)}</ol>
    <p>保持JWT（操作前）：<code className="jwt-encoded">{observation.beforeToken ?? 'なし'}</code></p>
    <p>保持JWT（操作後）：<code className="jwt-encoded">{observation.afterToken ?? 'なし'}</code></p>
    {observation.sentToken && <p>実際に送信したJWT：<code className="jwt-encoded">{observation.sentToken}</code></p>}
    {observation.result ? <>
      <p>HTTP {observation.result.status} · 理由：<code>{observation.result.code}</code></p>
      <p>通信記録は実際のヘッダー・本文の抜粋です。パスワードは伏せています。レスポンス全体はブラウザ開発者ツールのNetworkで確認できます。</p>
      <pre>{JSON.stringify(observation.result.http, null, 2)}</pre>
      <p>DBは観察用にも照会しています。JWTの有効性の判定にSession対応表は使いません。</p>
      <table><thead><tr><th>DB実測値</th><th>操作前</th><th>操作後</th></tr></thead><tbody><tr><th>users</th><td>{observation.result.before.users.length}件</td><td>{observation.result.after.users.length}件</td></tr><tr><th>sessions</th><td>{observation.result.before.sessions.length}件</td><td>{observation.result.after.sessions.length}件</td></tr></tbody></table>
      <p>公開鍵（検証用）・鍵ID：{observation.result.keyId}</p><pre>{JSON.stringify(observation.result.publicKey, null, 2)}</pre>
      <p>秘密鍵は表示しません。鍵はサーバーに永続保存され、再起動でも同じ鍵を使います。</p>
    </> : <p>HTTP通信なし。ブラウザでデコードした実行記録です。</p>}
  </details>;

  return <div className="page jwt-lab">
    <div className="page-heading"><div><span className="eyebrow">PHASE 07 · JWT</span><h1>読める。でも、書き換えると使えない。</h1><p>署名と期限を、予想してから確かめる。</p></div></div>
    <div className="jwt-toolbar"><div role="group" aria-label="学び方"><button disabled={busy} aria-pressed={mode === 'guided'} onClick={() => switchMode('guided')}>順番に学ぶ</button><button disabled={busy} aria-pressed={mode === 'free'} onClick={() => switchMode('free')}>自由に実験する</button></div><div role="group" aria-label="説明の詳しさ"><button aria-pressed={!detailed} onClick={() => setDetailed(false)}>やさしく</button><button aria-pressed={detailed} onClick={() => setDetailed(true)}>詳しく</button></div></div>
    {error && <p role="alert" className="notice error">{error}{!ready && <button onClick={() => void initialize()}>準備を再試行</button>}</p>}
    {mode === 'guided' ? <section className="jwt-focused" aria-label="JWTのガイド付き体験">
      <div className="lesson-progress"><span>{started ? jwtCourses[course].name : '目安5〜8分 · 予想して学ぶ'}</span><span>{started ? `${Math.min(index, jwtCourses[course].lessons.length)} / ${jwtCourses[course].lessons.length} 確認できた` : '基本3問・失敗5問'}</span></div>
      {!started ? <div className="lesson-card jwt-welcome"><span className="eyebrow">SIGNED, NOT ENCRYPTED</span><h2 ref={heading} tabIndex={-1}>「本物」と「まだ使える」は、<br />別々に確かめる。</h2><p>JWTの中身は読めます。では、なぜ利用者や期限を<br className="desktop-break" />好きに書き換えて使えないのでしょう？</p><JwtDiagram observation={null} frame={0} token={token} /><button className="button primary lesson-primary" disabled={!ready || busy} onClick={() => start('basic')}>JWTの基本を始める <ArrowRight size={18} /></button><button className="text-button" disabled={!ready || busy} onClick={() => start('failure')}>失敗する実験から始める</button><small>ガイドの進み具合を最初から始めます。SessionやDBの記録は削除しません。</small></div>
        : !lesson ? <div className="lesson-card jwt-complete"><CheckCircle2 size={36} /><h2 ref={heading} tabIndex={-1}>{course === 'basic' ? '読めることと、信用できることは別。' : '署名・期限・許可する方式。それぞれを確かめる。'}</h2><p>実行結果を確認しました。理解を自動採点したわけではありません。</p><label htmlFor="jwt-reflection">自分の言葉で：{course === 'basic' ? 'JWTに秘密情報を入れてはいけないのは、なぜ？' : 'expを延ばす書き換えと、自然な期限切れでは、何が違う？'}</label><textarea id="jwt-reflection" placeholder="言葉にしてみる（任意・この画面内のみ）" /><button className="button primary lesson-primary" onClick={() => course === 'basic' ? start('failure') : switchMode('free')}>{course === 'basic' ? '失敗する実験へ' : '自由に実験する'} <ArrowRight size={18} /></button><Link href="/session" className="text-button">Session編を見返す</Link></div>
          : <div className="lesson-card" aria-busy={busy}><span className="eyebrow">問い {index + 1} / {jwtCourses[course].lessons.length}</span><h2 ref={heading} tabIndex={-1}>{lesson.question}</h2>
            {!observation && <p>{lesson.intro}</p>}
            <JwtDiagram observation={observation} frame={frame} token={token} />
            {!observation ? <fieldset className="prediction-choices"><legend>どうなると思いますか？</legend>{[...lesson.choices, 'まだわからない'].map((choice, i) => <label key={choice}><input type="radio" name="jwt-prediction" checked={prediction === i} disabled={busy} onChange={() => setPrediction(i)} /><span>{choice}</span></label>)}<small>点数は付けません。予想が違っても先へ進めます。</small></fieldset>
              : <div className="jwt-explanation" aria-live="polite">{!confirmed ? <><strong>想定した結果を確認できませんでした</strong><p>{observation.result?.message ?? '必要な記録が揃っていません。'}</p><p>この結果では確認済みにしません。再試行するか、ガイドを最初から始め直せます。</p></> : finished ? <><strong>{prediction === lesson.choices.length ? '実験からわかったこと' : prediction === lesson.correct ? '予想と一致しました' : '予想との違いを見てみましょう'}</strong><small>あなたの予想：{prediction === lesson.choices.length ? 'まだわからない' : lesson.choices[prediction ?? 0]}</small><p>{lesson.answer}</p>{observation.result && <p className="jwt-verdict">HTTP {observation.result.status} · <code>{observation.result.code}</code></p>}</> : <><span className="eyebrow">実行記録 {frame + 1} / {observation.steps.length}</span><h3>{step?.title}</h3><p>{step?.why}</p>{detailed && <p className="muted">{step?.detail}</p>}<small>{step?.evidence === 'server' ? 'サーバーで実行した記録' : 'ブラウザで実行した記録'}</small></>}</div>}
            {lesson.action === 'expired' && !observation && <p className="jwt-countdown" role="status">{seconds > 0 ? `期限まで約${seconds}秒。JWTは書き換えずに待ちます。` : '期限を過ぎたか、サーバーに送って確かめましょう。'}</p>}
            {observation && finished && confirmed && lesson.action === 'decode' && selectedToken && <JwtParts token={selectedToken} detailed={detailed} />}
            <div className="lesson-controls">{observation && confirmed && frame > 0 && <button className="text-button" onClick={() => setFrame(frame - 1)}>ひとつ戻る</button>}<button className="button primary lesson-primary" disabled={busy || !ready || (!observation && (prediction === null || expiredWait))} onClick={() => !observation || !confirmed ? void execute(lesson.action) : next()}>{busy ? '実行・確認中…' : !observation ? lesson.button : !confirmed ? '同じ実験を再試行' : !finished ? '次へ' : index === jwtCourses[course].lessons.length - 1 ? '学んだことを振り返る' : '次の問いへ'}<ArrowRight size={18} /></button></div>
            {observation && !confirmed && <button className="text-button" onClick={() => start(course)}>ガイドを最初から始め直す</button>}
            {observation && <small className="lesson-note">操作は実行済みです。「次へ」は記録を読み進めます。</small>}{details}
          </div>}
    </section> : <section className="jwt-free" aria-label="JWTの自由実験">
      <div className="lesson-card"><h2>条件を変えて、確かめる</h2><p>保持中のJWT：<code>{tokenLabel(token)}</code>（再読み込みで消えます）</p><div className="jwt-inputs"><label>メールアドレス<input value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label><label>パスワード<input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label></div>
        <div className="jwt-actions">{([['issue', '5分のJWTを発行'], ['short', '15秒のJWTを発行'], ['decode', 'JWTを分解'], ['profile', 'Profileを取得'], ['tamper', 'roleを変えて送信'], ['none', 'alg: noneで送信']] as const).map(([action, label]) => <button className="button" disabled={busy || !ready || (!token && action !== 'issue' && action !== 'short')} key={action} onClick={() => void execute(action)}>{label}</button>)}</div><p className="muted">編集するのは送信用コピーです。期限切れは15秒のJWTで待ってからProfileを取得してください。鍵やTokenを外部へ送信する機能はありません。</p>
        {history.length > 0 && <label>見返す操作<select value={observation?.id ?? ''} onChange={e => { setObservation(history.find(h => h.id === e.target.value) ?? null); setFrame(0); }}><option value="">操作を選ぶ</option>{history.map((h, i) => <option key={h.id} value={h.id}>{i + 1}. {h.action} · {h.result ? `${h.result.status} / ${h.result.code}` : 'ブラウザでデコード'}</option>)}</select></label>}
      </div>
      {observation && <div className="lesson-card"><h2>選択した操作の実行記録</h2><JwtDiagram observation={observation} frame={frame} token={token} /><div className="jwt-explanation"><h3>{finished ? observation.result?.message ?? 'ブラウザだけで中身を読みました（未検証）。' : step?.title}</h3><p>{finished ? 'これは操作直後の記録です。上の保持中JWTとは時点が異なる場合があります。' : step?.why}</p>{detailed && !finished && <p>{step?.detail}</p>}</div><div className="jwt-actions"><button disabled={frame === 0} onClick={() => setFrame(frame - 1)}>ひとつ戻る</button><button disabled={finished} onClick={() => setFrame(frame + 1)}>記録の次へ</button></div>{finished && selectedToken && <JwtParts token={selectedToken} detailed={detailed} />}{details}</div>}
    </section>}
    <p className="jwt-footer">今回扱うのは署名付きJWT（JWS）です。暗号化JWT（JWE）やOAuth／OIDCは後の教材と区別します。Token・実行記録・ガイドの進捗は画面内だけに保持します。</p>
  </div>;
}
