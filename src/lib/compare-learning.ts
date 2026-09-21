import { confirmedLogin, confirmedLogout, confirmedProfile } from './learning';
import { readJwt } from './jwt-learning';
import type { CompareAction, CompareMemory, CompareObservation } from './compare-types';

export type CompareLesson = { action: CompareAction | 'revocation' | 'scale'; question: string; intro: string; button: string; choices: string[]; correct: number; answer: string };
export const compareLessons: CompareLesson[] = [
  { action: 'prepare', question: 'ログイン後の「使える」は、どこに残る？', intro: '同じサンプル利用者でSessionとJWTを発行します。現在のSessionは新しいものに置き換わります。比較用に両方のコピーをこの画面内だけに控えます。', button: '両方を発行して確かめる', choices: ['どちらも、トークンごとの有効状態をDBに記録する', 'SessionはDBに対応表、JWTは署名付きの情報を持つ'], correct: 1, answer: 'SessionはDBに番号と利用者の対応が残りました。JWTは利用者・期限を署名付きで持ち、JWTごとの有効状態はDBに作りません。usersと署名鍵は別途必要です。' },
  { action: 'access', question: '次のアクセスでは、何を確かめる？', intro: '発行とは別の操作で、それぞれのProfileを取得します。パスワードは送りません。', button: '両方でProfileを取得する', choices: ['SessionはDBの対応、JWTは署名と発行者・宛先・期限など', 'どちらも、届いた文字列があれば受け入れる'], correct: 0, answer: '両方とも200でしたが、判断の根拠は異なります。SessionはDBの現在の記録、JWTは検証した発行時の情報です。JWTも公開鍵と検証ルールなしで信用できるわけではありません。' },
  { action: 'logout', question: 'ログアウトで、サーバー側も変わる？', intro: 'Sessionは従来のログアウトAPIを実行。JWTはこの画面の通常利用用の値を手放します。先ほど控えた実験用コピーは、両方とも残します。', button: '両方をログアウトする', choices: ['どちらも、サーバーに失効したことが伝わる', 'SessionのDB記録は消えるが、JWTは自動では失効しない'], correct: 1, answer: 'SessionはCookieとDBの対応表が消えました。JWTは通常利用用の値を手放しただけで、サーバーへ失効を登録する処理はありません。再送で確かめるため、コピーは別に残しています。' },
  { action: 'replay', question: 'ログアウト前のコピーなら、もう一度使える？', intro: '控えた値を一字も変えず再送します。Session IDは実験APIのJSON本文で同じDBに照合。JWTはBearerとしてProfile APIへ送ります。', button: '同じコピーを再送する', choices: ['ログアウトしたので、両方とも拒否される', 'Sessionは記録がないため拒否、JWTは期限内なら受理される'], correct: 1, answer: 'Sessionは番号を送ってもDBの記録がなく401。JWTは同じ署名付きトークンが期限内なので200でした。この構成では「ブラウザから手放す」と「コピーを含めて使えなくする」は別の操作です。' },
  { action: 'revocation', question: 'あるJWTだけを、期限前に止めるには？', intro: 'ここからは説明モデルです。失効リストを参照する設計へ変えると、何が増えるかを考えます。実APIやDBは変更しません。', button: '失効の設計を比べる', choices: ['ブラウザの値を消せば、全コピーも使えなくなる', '署名検証に加えて、失効したかを確認する状態が要る'], correct: 1, answer: '失効リストなどを照会すれば個別に止められます。その代わり、サーバーが共有・確認する状態が増えます。短命化は残りの利用可能時間を短くする方法で、即時失効とは異なります。' },
  { action: 'scale', question: '検証サーバーを2台に増やすと、何を共有する？', intro: '説明モデルで方式を切り替えます。実際に複数サーバーを起動したり、性能を測定したりする実験ではありません。', button: '2台の構成を比べる', choices: ['Sessionは増設できず、JWTなら共有物は一切ない', 'Sessionは状態の参照先、JWTも公開鍵や検証条件をそろえる'], correct: 1, answer: 'Sessionも共有ストアを使って増設できます。JWTは個別Sessionの照会を省けますが、公開鍵・検証条件・時刻管理は必要です。失効リストを加えれば、その共有や反映遅延も設計する必要があります。' },
];

const sameCopy = (a: CompareMemory, b: CompareMemory) => !!a.copy && a.copy.sessionId === b.copy?.sessionId && a.copy.jwt === b.copy.jwt;
export function confirmsComparison(o: CompareObservation, previous?: CompareObservation): boolean {
  try {
    const pair = o.memoryAfter.copy;
    if (!pair || !o.after || !o.before) return false;
    const sub = readJwt(pair.jwt).payload.sub;
    const jwt = o.jwt;
    const unchangedJwtDB = !!jwt && JSON.stringify(jwt.before.sessions) === JSON.stringify(jwt.after.sessions);
    if (o.action === 'prepare') {
      return !!o.session && confirmedLogin({ action: 'login', result: o.session, before: o.before, after: o.after }) === pair.sessionId
        && jwt?.status === 200 && jwt.code === 'valid' && jwt.token === pair.jwt
        && o.memoryAfter.activeJwt === pair.jwt && sub === o.after.user?.id && unchangedJwtDB;
    }
    if (!previous || !sameCopy(o.memoryBefore, previous.memoryAfter) || !sameCopy(o.memoryBefore, o.memoryAfter)) return false;
    if (o.action === 'logout') {
      return previous.action === 'access' && !!o.session && o.memoryBefore.activeJwt === pair.jwt && o.memoryAfter.activeJwt === null
        && confirmedLogout({ action: 'logout', result: o.session, before: o.before, after: o.after }, pair.sessionId);
    }
    if (!jwt || jwt.status !== 200 || jwt.code !== 'valid' || jwt.claims?.sub !== sub
      || jwt.http.requestHeaders.Authorization !== `Bearer ${pair.jwt}` || !unchangedJwtDB) return false;
    if (o.action === 'access') {
      return previous.action === 'prepare' && o.memoryBefore.activeJwt === pair.jwt && o.memoryAfter.activeJwt === pair.jwt
        && !!o.session && confirmedProfile({ action: 'profile', result: o.session, before: o.before, after: o.after }, pair.sessionId);
    }
    const replay = o.replay;
    return previous.action === 'logout' && o.memoryBefore.activeJwt === null && o.memoryAfter.activeJwt === null
      && !o.before.cookie && !o.after.cookie && !o.after.authenticated
      && !!replay && replay.status === 401 && replay.code === 'missing' && replay.receivedVia === 'json-body'
      && replay.sessionId === pair.sessionId && (replay.http.requestBody as { sessionId?: string })?.sessionId === pair.sessionId
      && !replay.before.sessions.some(s => s.id === pair.sessionId) && !replay.after.sessions.some(s => s.id === pair.sessionId)
      && !o.after.snapshot.sessions.some(s => s.id === pair.sessionId);
  } catch { return false; }
}
