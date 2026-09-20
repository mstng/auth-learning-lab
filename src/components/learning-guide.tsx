'use client';
import { useState } from 'react';
import { Monitor, Server, Database, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';
const stories = {
  login: { label: '① 最初のログイン', title: 'パスワードで本人確認し、次回使う番号を渡す。', send: 'メール・パスワードを送る', back: '受付番号を渡す', dbSend: '登録情報を調べ、番号を保存', dbBack: '登録情報・保存結果', browser: '受け取った受付番号をCookieに保存します。', server: 'パスワードを照合し、ランダムな受付番号を作ります。', db: '「番号 → 利用者 → 有効期限」の対応を保存します。', takeaway: 'Cookieはブラウザの保存の仕組み。Sessionはサーバー側のログイン記録。このアプリでは、同じ番号で両者を結びます。' },
  profile: { label: '② ログイン後のアクセス', title: '次からは受付番号を送り、サーバーが毎回確かめる。', send: 'Cookieの受付番号を送る', back: '確認できたらプロフィールを返す', dbSend: '番号の記録・期限を調べる', dbBack: '利用者と有効期限', browser: '条件に合うアクセスに、Cookieを自動で付けます。パスワードの再入力は不要です。', server: '記録・期限・利用者の状態を確認してから、情報を返します。', db: '番号に対応する利用者と期限を取り出します。', takeaway: 'Cookieの中に「ログイン済み」と書けばよいわけではありません。最終的に判断するのはサーバーです。' },
  logout: { label: '③ ログアウト', title: '対応表の記録を消し、ブラウザにも番号を忘れてもらう。', send: 'ログアウトを頼む', back: 'Cookieの削除を指示する', dbSend: '番号の記録を削除する', dbBack: '削除結果', browser: 'サーバーからの指示を受けて、Cookieを削除します。', server: 'DBの記録を消したうえで、Cookieの削除を指示します。', db: '受付番号の行が消えるので、古い番号では利用できなくなります。', takeaway: 'Cookieを消すだけでは、サーバーの記録は残ります。このアプリでは両方を削除します。' },
  expire: { label: '④ 期限切れ', title: '番号が残っていても、期限が過ぎたら使えない。', send: '残っている受付番号を送る', back: 'ログインをやり直してもらう（401）', dbSend: '番号の有効期限を調べる', dbBack: '期限が過ぎた記録', browser: 'この実験では、Cookieの番号を残したままアクセスします。', server: 'DBの期限が過ぎているため、ログイン済みとは認めません。', db: '実験ボタンで、ログイン記録の期限を過去に変えておきます。', takeaway: '「番号を持っている」と「その番号が今も有効」は別のことです。' },
  password: { label: 'パスワードの照合', title: 'まずは「本人かどうか」を確かめるところから。', send: 'メール・パスワードを送る', back: '照合結果を返す', dbSend: '登録情報を調べる', dbBack: '保存済みのハッシュ', browser: '画面に入力した情報を、サーバーに渡します。', server: '入力したパスワードを、保存済みのハッシュと照合します。', db: 'パスワードそのものではなく、照合用のハッシュを保管しています。', takeaway: 'このページは本人確認だけ。ログインを続けるための受付番号やSessionは作りません。' },
} as const;
type Scene = keyof typeof stories;
function Connection({ send, back }: { send: string; back: string }) {
  return <div className="map-connection"><div><span>{send}</span><ArrowRight aria-hidden="true" /></div><div><ArrowLeft aria-hidden="true" /><span>{back}</span></div></div>;
}
export function LearningGuide({ password = false }: { password?: boolean }) {
  const [scene, setScene] = useState<Scene>('login');
  const story = stories[password ? 'password' : scene];
  return <section className="panel learning-guide" aria-label="システムのつながり">
    <div className="guide-heading"><div><span className="eyebrow">まずは、全体像から</span><h2><BookOpen size={21} /> ログインの裏側を、3つの場所で考える</h2></div><span className="tag">説明用の図 · 実データではありません</span></div>
    {!password && <div className="story-switch" role="group" aria-label="図の場面を切り替える">{(['login', 'profile', 'logout', 'expire'] as const).map(key => <button key={key} aria-pressed={scene === key} onClick={() => setScene(key)}>{stories[key].label}</button>)}</div>}
    <div className="story-content" aria-live="polite"><h3>{story.title}</h3>
      <div className="system-map">
        <article className="map-place browser-place"><span className="place-zone">あなたの端末</span><h4><Monitor size={23} /> ブラウザ</h4><span className="map-role">操作画面 ＋ Cookieの保管場所</span><p>{story.browser}</p><div className="storage-example">{password ? '入力 → サーバーへ送信' : scene === 'logout' ? 'Cookie：受付番号を削除' : <>Cookie：受付番号 <b>ABC…</b></>}</div></article>
        <Connection send={story.send} back={story.back} />
        <article className="map-place server-place"><span className="place-zone">サーバー側 · 処理する場所</span><h4><Server size={23} /> サーバー</h4><div className="server-roles"><span>本人確認の窓口</span><span>情報を返す窓口</span></div><p>{story.server}</p><small>このアプリでは、同じサーバーが2つの役割を担当します。</small></article>
        <Connection send={story.dbSend} back={story.dbBack} />
        <article className="map-place database-place"><span className="place-zone">サーバー側 · 保存する場所</span><h4><Database size={23} /> データベース</h4><span className="map-role">登録情報 ＋ ログインの対応表</span><p>{story.db}</p><div className="storage-example">{password ? 'users：照合用のハッシュ' : scene === 'logout' ? 'sessions：番号の行を削除' : <>sessions：<b>ABC…</b> → あなた → {scene === 'expire' ? '期限切れ' : '有効期限'}</>}</div></article>
      </div>
      <p className="guide-takeaway">{story.takeaway}</p>
    </div>
    <p className="guide-caption">矢印は情報の行き来。ブラウザはDBを直接操作しません。DBはこのアプリに内蔵されています。ABC…は説明用の架空の番号です。</p>
    <details className="guide-glossary"><summary>用語を確認する：Cookie・Session・API・DB</summary><dl><div><dt>Cookie</dt><dd>ブラウザがデータを保存し、条件に合うアクセスで自動送信する仕組み。ここでは受付番号を入れます。</dd></div><div><dt>Session / Session ID</dt><dd>Sessionはサーバー側のログイン記録。Session IDはその記録を探す番号です。「受付番号」はたとえで、実際には推測しにくいランダムな値です。</dd></div><div><dt>API / DB</dt><dd>APIは処理を頼む窓口。DB（データベース）はデータの保管庫です。</dd></div><div><dt>認証 / 認可</dt><dd>認証は「誰か」を確かめること。認可は「その操作をしてよいか」を判断することです。</dd></div></dl></details>
    <div className="first-experiment"><strong>まずはこの操作だけでOK</strong><p>{password ? '下の「パスワードを照合」を押す → 「次へ」で本人確認の過程を追う。' : '下の「ログイン → Profile」を押す → 「次へ」で記録を追う → Cookieの番号とDBの番号を比べる。'}</p><small>上の場面切り替えは説明のみです。実際のログイン操作は、下のボタンで行います。</small></div>
  </section>;
}
