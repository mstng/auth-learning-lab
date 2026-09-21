import { confirmedLogin, confirmedLogout, confirmedProfile, requestSession, type Observation } from './learning';

export type Course = 'basic' | 'failure';
export type TourAction = 'login' | 'wrong-login' | 'profile' | 'logout' | 'lab/expire' | 'lab/reset';
export type Lesson = {
  question: string; intro: string; action: TourAction; button: string; answer: string;
  frames: readonly number[]; choices: readonly string[]; correct: number; comparison?: boolean;
};
export const courses: Record<Course, { name: string; lessons: Lesson[] }> = {
  basic: { name: '基本の流れ', lessons: [
    { question: 'ログインすると、何が保存される？', intro: '最初に結果を予想してから、実際にログインして確かめましょう。', action: 'login', button: 'ログインして確かめる', answer: 'ブラウザには番号、DBには「番号と利用者の対応」が保存されました。パスワードをCookieに保存したわけではありません。', frames: [3, 5, 6, 7, 8], choices: ['ブラウザにパスワードが保存される', 'ブラウザに番号、DBに番号と利用者の対応が保存される'], correct: 1, comparison: true },
    { question: '次のアクセスでは、何を送る？', intro: 'ログインした後、自分のプロフィールを開くときを考えます。', action: 'profile', button: '自分の情報を見る', answer: '同じ番号を送り、パスワードを送らずにプロフィールを取得できました。サーバーは番号に対応する記録と期限を確認しています。', frames: [1, 2, 3], choices: ['ログインで保存した受付番号', 'メールアドレスとパスワード'], correct: 0 },
    { question: 'ログアウトすると、何が消える？', intro: 'このアプリが、ブラウザとDBのそれぞれをどう片付けるか予想します。', action: 'logout', button: 'ログアウトして確かめる', answer: 'ブラウザの番号と、DBにあるその番号の記録が、両方とも消えました。片方を消すだけの動きではありません。', frames: [1, 2], choices: ['ブラウザの番号だけ', 'DBの記録だけ', 'ブラウザの番号とDBの記録の両方'], correct: 2, comparison: true },
    { question: 'ログアウト後も、情報を見られる？', intro: 'もう一度、同じプロフィールを開いてみましょう。', action: 'profile', button: 'もう一度、自分の情報を見る', answer: '番号を送れないので、プロフィールを取得できませんでした。この拒否が正しい結果です。以前ログインしたことだけでは、今回のアクセスは許可されません。', frames: [1, 3], choices: ['前にログインしたので見られる', '本人確認できず、取得を断られる'], correct: 1 },
  ] },
  failure: { name: '失敗から学ぶ', lessons: [
    { question: 'パスワードを間違えたら、番号は作られる？', intro: '未ログインの状態から、学習用の間違ったパスワードで試します。', action: 'wrong-login', button: '間違ったパスワードで試す', answer: '本人だと確認できず401になり、新しい番号もDBのSessionも作られませんでした。メールアドレスが合っているだけではログインできません。', frames: [3, 4], choices: ['番号は作られるが、情報は見られない', '本人確認に失敗し、番号は作られない'], correct: 1, comparison: true },
    { question: '正しいパスワードなら、ログインできる？', intro: '同じユーザーで、今度は正しいパスワードを使います。次の期限切れ実験の準備にもなります。', action: 'login', button: '正しいパスワードでログイン', answer: '今回は本人確認ができ、番号と対応表が保存されました。この番号を使って、次の実験へ進みます。', frames: [3, 5, 6, 8], choices: ['番号と対応表が作られてログインできる', '一度間違えたので、もうログインできない'], correct: 0, comparison: true },
    { question: 'DBの期限だけ切らすと、Cookieはどうなる？', intro: '実験用の操作で、DBにある期限を過去に変えます。自然な時間経過を待つ操作とは別です。', action: 'lab/expire', button: 'DBの期限だけ切らす', answer: 'DBの記録は期限切れになりましたが、ブラウザには同じ番号が残っています。番号の保存と、使えるかどうかは別の話です。', frames: [1, 2], choices: ['Cookieの番号も一緒に消える', 'Cookieには同じ番号が残る'], correct: 1, comparison: true },
    { question: '番号が残っていれば、情報を見られる？', intro: 'Cookieに番号があり、DBではその番号が期限切れです。この状態でアクセスします。', action: 'profile', button: '期限切れの番号でアクセス', answer: '番号は送られましたが、DBの期限が切れているので401になりました。Cookieがあるだけではログイン済みになりません。', frames: [1, 2, 3], choices: ['同じ番号があるので見られる', 'DBの期限切れを確認して、取得を断られる'], correct: 1 },
    { question: 'ログインし直すと、古い番号を使い続ける？', intro: '正しいパスワードで、もう一度本人確認します。古い番号と比べてみましょう。', action: 'login', button: 'ログインし直して確かめる', answer: '新しい番号に変わり、古い番号のDB記録は削除されました。新しい番号と有効な記録で、ログイン状態を作り直しています。', frames: [5, 6, 7, 8], choices: ['古い番号のまま、期限だけ延びる', '新しい番号になり、古い番号は使えなくなる'], correct: 1, comparison: true },
  ] },
};

/** Require the observed Cookie, matching DB record and expected response, never just a click or a 401. */
export function confirmsLesson(course: Course, index: number, o: Observation, previous?: Observation): boolean {
  if (!o.after) return false;
  const sent = requestSession(o.result);
  const priorId = previous?.after?.cookie?.value;
  if (course === 'basic') {
    if (index === 0) return !!confirmedLogin(o);
    if (index === 1) return !!priorId && confirmedProfile(o, priorId);
    if (index === 2) return !!priorId && confirmedLogout(o, priorId);
    return o.action === 'profile' && o.result.http.status === 401 && !sent && !o.after.cookie && !o.after.authenticated
      && previous?.action === 'logout' && !!previous.after && !previous.after.cookie;
  }
  if (index === 0) return o.action === 'login' && o.result.http.status === 401 && !o.before.cookie && !o.after.cookie
    && !o.after.authenticated && o.before.snapshot.sessions.length === 0 && o.after.snapshot.sessions.length === 0
    && o.result.trace.some(s => s.what === 'Password Hashを検証' && s.data.matched === false);
  if (index === 1) return !!confirmedLogin(o);
  if (index === 4) {
    const newId = confirmedLogin(o);
    return !!newId && !!priorId && o.before.cookie?.value === priorId && newId !== priorId
      && o.before.snapshot.sessions.some(s => s.id === priorId) && !o.after.snapshot.sessions.some(s => s.id === priorId);
  }
  const beforeRecord = o.before.snapshot.sessions.find(s => s.id === priorId);
  const afterRecord = o.after.snapshot.sessions.find(s => s.id === priorId);
  const sameId = !!priorId && sent === priorId && o.before.cookie?.value === priorId && o.after.cookie?.value === priorId;
  if (!sameId || !beforeRecord || !afterRecord || o.after.sessionStatus !== '期限切れ' || o.after.authenticated) return false;
  if (index === 2) return o.action === 'lab/expire' && o.result.success && o.before.authenticated
    && beforeRecord.expires_at !== afterRecord.expires_at && afterRecord.user_id === beforeRecord.user_id
    && Date.parse(afterRecord.expires_at) <= Date.parse(o.after.serverTime);
  return o.action === 'profile' && o.result.http.status === 401 && o.result.http.requestBody === undefined
    && previous?.action === 'lab/expire' && beforeRecord.expires_at === afterRecord.expires_at;
}
