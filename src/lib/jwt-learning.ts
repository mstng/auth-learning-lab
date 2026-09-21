import { base64url, decodeJwt, decodeProtectedHeader } from 'jose';
import type { JwtResult, JwtStep } from './jwt-types';

export type JwtAction = 'issue' | 'decode' | 'profile' | 'tamper' | 'short' | 'expired' | 'none';
export type JwtCourse = 'basic' | 'failure';
export type JwtObservation = {
  id: string; action: JwtAction; beforeToken: string | null; afterToken: string | null;
  sentToken: string | null; decodedToken?: string; result?: JwtResult; steps: JwtStep[];
};
export type JwtLesson = { question: string; intro: string; button: string; action: JwtAction; choices: string[]; correct: number; answer: string };
export const jwtCourses: Record<JwtCourse, { name: string; lessons: JwtLesson[] }> = {
  basic: { name: '中身を読む・信用して使う', lessons: [
    { question: 'JWTを発行すると、どこに何が残る？', intro: 'サンプル利用者のパスワードで本人確認し、5分間使えるJWTを発行します。Profileはまだ取得しません。', button: 'JWTを発行して確かめる', action: 'issue', choices: ['ブラウザにJWT、DBにJWTごとの対応表が残る', 'ブラウザにJWTが残り、DBにJWTごとの対応表は作られない'], correct: 1, answer: 'この教材ではJWTをブラウザの画面内メモリーに保持しました。usersは本人確認に使いますが、JWTごとの有効・無効の記録は作りません。署名鍵はサーバーに保存します。' },
    { question: '秘密鍵がなくても、JWTの中身は読める？', intro: '今あるJWTを、このブラウザだけで分解します。APIへの通信は行いません。', button: 'JWTの中身を読む', action: 'decode', choices: ['読める。ただし本物かどうかはまだ分からない', '秘密鍵で復号しないと読めない'], correct: 0, answer: 'HeaderとPayloadはBase64URLをデコードするだけで読めました。今回のJWSは暗号化ではありません。読めた値は未検証なので、利用者の判定にはまだ使えません。' },
    { question: '読めた内容を、そのまま信用してよい？', intro: 'JWTをAuthorization: Bearerに付けてProfile APIへ送ります。パスワードは送りません。', button: 'JWTで自分の情報を見る', action: 'profile', choices: ['読めれば、書いてある利用者として扱ってよい', '公開鍵で署名と、発行者・宛先・期限などを検証する'], correct: 1, answer: '公開鍵による署名検証と利用条件の確認を通って、Profileを取得できました。署名だけでなく、誰が発行したか・どこ宛てか・いつまで使えるかも必要です。返す属性はJWT発行時の値です。' },
  ] },
  failure: { name: '失敗から署名と期限を学ぶ', lessons: [
    { question: '改ざん実験のためのJWTを用意しよう', intro: 'まず一般ユーザーのJWTを発行します。既存のSessionは初期化しません。', button: '実験用JWTを発行する', action: 'issue', choices: ['JWTの秘密鍵もブラウザへ届く', 'ブラウザへ届くのはJWTと公開鍵の情報'], correct: 1, answer: '秘密鍵はサーバーに残り、ブラウザには渡りません。JWTはこの画面内だけで保持します。次にPayloadのroleを書き換えてみましょう。' },
    { question: 'roleをadminに書き換えれば、管理者になれる？', intro: '送信用コピーのroleだけをadminへ変更します。Headerと署名は元のままです。', button: 'Payloadを書き換えて送る', action: 'tamper', choices: ['adminと書いたので、管理者として受理される', '署名が一致せず、利用を断られる'], correct: 1, answer: '書き換えたPayloadは読めますが、元の署名と一致しないので拒否されました。読めることと、改ざんして使えることは違います。元のJWTはそのまま保持しています。' },
    { question: '15秒の期限は、どこに書かれる？', intro: '新しい短命JWTを発行します。SessionのDB期限とは別の実験です。', button: '15秒のJWTを発行する', action: 'short', choices: ['署名対象のPayloadのexpに書かれる', 'SessionのDBレコードだけに書かれる'], correct: 0, answer: '新しいJWTのexpに利用期限が入りました。この時点では発行しただけです。次の問いで実際の時間経過を待ち、同じJWTを送ります。' },
    { question: '署名が本物なら、期限が切れても使える？', intro: 'JWTは書き換えず、そのまま保持して待ちます。下の残り時間は目安で、最終判断はサーバーの時刻で行います。', button: '同じJWTを期限後に送る', action: 'expired', choices: ['署名が本物なので使える', '署名が本物でも、expを過ぎると使えない'], correct: 1, answer: 'ブラウザに同じJWTが残っていても、サーバーはexpを過ぎたため拒否しました。期限の数字を書き換えた実験ではなく、同じ署名付きJWTの自然な失効です。' },
    { question: '「署名なし」と宣言すれば、検証を省略できる？', intro: '送信用コピーのHeaderをalg: noneにし、署名を空にします。', button: 'alg: noneのJWTを送る', action: 'none', choices: ['送信者が指定したので、署名検証を省略する', 'サーバーが許可するRS256ではないので拒否する'], correct: 1, answer: 'サーバーの許可リストはRS256だけなので拒否されました。トークンが自称する方式に合わせて、検証のルールを緩めてはいけません。' },
  ] },
};

export function readJwt(token: string) {
  const segments = token.split('.');
  if (segments.length !== 3) throw new Error('JWTは3つの部分に分かれている必要があります。');
  return { header: decodeProtectedHeader(token), payload: decodeJwt(token), segments };
}
/** Encoding edits for a controlled local experiment; never signs or validates tokens. */
export function changeJwt(token: string, kind: 'tamper' | 'none') {
  const { header, payload, segments } = readJwt(token);
  if (kind === 'tamper') return `${segments[0]}.${base64url.encode(JSON.stringify({ ...payload, role: payload.role === 'admin' ? 'user' : 'admin' }))}.${segments[2]}`;
  return `${base64url.encode(JSON.stringify({ ...header, alg: 'none' }))}.${segments[1]}.`;
}
export function tokenLabel(token: string | null) {
  if (!token) return 'なし';
  return `${token.slice(0, 8)}…${token.slice(-12)}`;
}
export function confirmsJwtLesson(action: JwtAction, o: JwtObservation, previous?: JwtObservation) {
  if (o.action !== action) return false;
  if (action === 'decode') {
    if (!o.decodedToken || o.decodedToken !== o.beforeToken || o.afterToken !== o.beforeToken || previous?.afterToken !== o.beforeToken || o.result) return false;
    try { return !!readJwt(o.decodedToken).payload.sub; } catch { return false; }
  }
  const r = o.result;
  if (!r || !r.before || !r.after) return false;
  const unchanged = JSON.stringify(r.before.sessions) === JSON.stringify(r.after.sessions);
  if (!unchanged) return false;
  if (action === 'issue' || action === 'short') {
    if (r.status !== 200 || r.code !== 'valid' || !r.token || r.token !== o.afterToken) return false;
    const { payload, header } = readJwt(r.token);
    return header.alg === 'RS256' && !!payload.sub && payload.exp! - payload.iat! === (action === 'short' ? 15 : 300);
  }
  if (!o.beforeToken || previous?.afterToken !== o.beforeToken || o.afterToken !== o.beforeToken) return false;
  if (action === 'profile') return o.sentToken === o.beforeToken && r.status === 200 && r.code === 'valid' && !!r.claims;
  if (action === 'expired') return previous?.action === 'short' && o.sentToken === o.beforeToken && r.status === 401 && r.code === 'expired'
    && readJwt(o.beforeToken).payload.exp! * 1000 <= Date.parse(r.serverTime);
  return o.sentToken === changeJwt(o.beforeToken, action) && r.status === 401 && r.code === (action === 'tamper' ? 'signature' : 'algorithm');
}
