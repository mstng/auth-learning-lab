# Authentication Learning Lab — PHASE 1〜9

**実際のPassword・Session・JWTを動かし、通信・保存場所・検証結果を観察する日本語の学習アプリです。** 完成範囲はPHASE 1〜9。v1.9でAccess / Refresh Tokenの期限切れ・更新・再利用検知を体験する教材を追加しました。Session・JWT・比較編の既存の操作は維持しています。

## 最短の起動手順（Docker・外部DB不要）

必要なのは **Node.js 24以上** です。ZIPを展開してフォルダーへ移動し、次を実行します。

```bash
npm ci
npm run dev
```

ブラウザーで **http://localhost:3000** を開いてください。`.env`の作成やPostgreSQLのインストールは不要です。最初の画面アクセス時にPGliteとデモユーザーを初期化します。

停止はターミナルでCtrl+C。再び `npm run dev` で起動できます。学習データはプロジェクト内の **data/authlab/** に永続保存され、再起動や再ビルドで消えません。CookieとSessionの期限が有効な間はログインも継続します。

ビルド済みアプリとして起動する場合:

```bash
npm run build
npm start
```

開発用・ビルド済みのどちらも同じ保存先を使います。同じデータを使うアプリは同時に1つだけ起動できます。起動中の別プロセスがある場合は起動ロックで拒否します。開発サーバーと `npm start` を同時に実行しないでください。

必要な場合のみ `.env.example` を `.env` にコピーして、PORT・APP_ORIGIN・LAB_DATA_DIR等を変更できます。初期状態は127.0.0.1でのみ待ち受け、localhostのOriginを許可します。

全データを消したい場合だけ、アプリを停止して `data/authlab/` フォルダーを削除してください。画面の「実験を初期化」は自分のSessionだけを削除します。

### データベース方式の変更

v1.1では、Node.js内で動く **PGlite（PostgreSQLの組み込み版）** を標準DBにしました。SQL・テーブル・トランザクション・外部キーを使いますが、独立したPostgreSQLサーバーへのTCP通信はありません。画面のProtocol表示も「SQL / PGlite（同一プロセス内）」に変更しています。
旧Docker版のVolumeからの自動移行はありません。学習用のデータは新規作成されます。複数プロセス・複数サーバー運用向けではなく、個人のローカル学習用です。

## v1.9：短命なAccessをRefreshで更新する（PHASE 9）

`/tokens`（メニュー「AccessとRefresh」）を開きます。**予想→実際の結果→図の証拠→理由**の8問。「まだわからない」も選べ、採点はありません。やさしい説明が既定で、HTTPステータス・期限の日本時間表示・系列IDは「詳しく」、送信値とDB前後は折りたたみから確認できます。

1. **2種類を発行**：最初のAccessは実験用15秒、Refreshは30分。DBには更新用のハッシュ・系列・世代を記録。
2. **送る先を間違える**：RefreshをProfileのBearerで送ると拒否。
3. **同じAccessの自然失効**：実時間で15秒の期限を待って送ると401。Refreshを持っているだけでは自動更新されない。
4. **Refreshで更新**：パスワードなしの別リクエストで新しいAccess（5分）とRefreshを発行。古いRefreshは使用済みに。
5. **新しいAccessでProfile取得**：更新とは別操作で200を確認。
6. **古いRefreshを再送**：再利用を検知し、同じToken Family全体の更新を停止。
7. **最新Refreshで更新**：新しい世代でも、系列が停止済みなので401。
8. **発行済みAccessを再送**：この構成では、期限内の同じAccessは200。「更新を止める」と「今あるAccessを即座に止める」の違いを確認。

### 保存・期限・実測の境界

- Accessは既存jose / RS256を使用し、アルゴリズム・iss・aud・exp・typなどを検証。個別の有効状態はDBに保存しません。
- Refreshは256bitの不透明な乱数。DBには標準SHA-256のハッシュを保存し、平文を保存しません。ローテーションでは使用済み化と新規発行を同一トランザクションで実施。署名失敗時にはDB変更も取り消します。
- Refreshは**初回発行から30分の絶対期限**で、更新しても延長しません。Accessの15秒／5分、既存Sessionの期限とは別です。
- 再利用検知は「第三者を特定できた」という意味ではありません。正規クライアントの同時更新や、応答が届かなかった後の再送でも検知され得ます。結果不明の場合は成功扱いせず、自動再送もしません。
- 2種類の平文、古いRefreshの実験用コピー、操作履歴は**画面内メモリーだけ**。Cookie/localStorage/sessionStorageには保存しません。本番の保存方式の推奨ではありません。リロードで画面内の値は消えますが、DBの系列は残ります。新しく発行すると別系列になります。
- 自由実験では**系列の手動停止**と**DBの更新期限を過去にする操作**も可能。後者は実DBを変更する教育操作で、自然失効とは明確に分けます。ブラウザのコピーは再送実験のため残します。
- 図の配置・強調は説明用、表示値とDB状態は選択した操作の実記録です。記録の読み返しはAPIを再実行せず、現在のトークンを履歴の値に戻しません。既存Database ViewerのRefresh欄も実記録を表示します。
- 初回はサンプル利用者のパスワードを実照合する教材専用APIです。**OAuthの認可フロー、Password Grant、ID Tokenは実装していません**。OAuthのクライアント・同意・scopeは次のPHASEです。

### v1.8以前から最新版への更新

1. 起動中のアプリを停止し、現在の作業を保存する。
2. Gitの場合は`git pull --ff-only`。ZIPの場合は新版を別フォルダーに展開し、旧版の`data/`を署名鍵ごとコピーする。
3. `npm ci` → `npm run dev`。
4. 右上の**v1.9**と**AccessとRefresh**の入口を確認する。

初回DBアクセスで新しいテーブル・列・インデックスを追加します。**data/の削除や手動リセットは不要**です。既存users・Session・署名鍵・ロードマップのチェックを保持します。`data/`・`data.bak-*/`等のignoreルールも維持しています。

以下のv1.8以前の節は各版で追加した機能の記録です。最新版への更新は上の手順を使ってください。

## v1.8：ログアウト後のコピーを再送する（PHASE 8）

`/compare`（メニュー「SessionとJWTの比較」）で、予想→実行→記録の読み返しを6問で進めます。「まだわからない」も選べ、点数や合否は付けません。既定は「やさしく」。自由実験は別画面に切り替えます。

1. **どこに残る？** 同じ利用者のSessionとJWTを実際に発行。SessionのDB記録と、JWTの署名付き情報を比較。
2. **何で判断する？** 発行とは別操作でProfileを取得。Sessionは現在のDB状態、JWTは検証済みの発行時属性。
3. **ログアウトで何が変わる？** SessionのCookieとDB行を削除。JWTは画面の通常利用用の値を手放す。
4. **コピーは使える？** ログアウト前に控えた同一の値を実際に再送。Sessionは記録なしで401、JWTは期限内なら200。
5. **あるJWTだけを今すぐ止めるには？** 説明モデルで失効リストの有無を切り替え、状態の保存・照会が増えることを考える。
6. **検証サーバーが2台になったら？** 説明モデルでSession／JWT／JWT＋失効リストを切り替え、共有ストア・鍵と検証条件・更新反映の違いを考える。

### 実際に起きることと、説明モデルの境界

- **最初の4問は実測**。既存のlogin / profile / logoutとJWT APIを使用します。発行実験では現在のSessionを新しいSessionに置き換えることを、実行前に明示します。DBスキーマ・利用者・ロードマップの進捗は変更しません。
- **実験用コピーは意図的に残します**。Session IDは教材APIが返す観測値から控え、HttpOnly CookieをJavaScriptで読み取るわけではありません。JWTの通常利用用の保持を解除しても、実験用コピーと履歴は画面内に残ります。再読み込みですべて消えます。永続ストレージには保存しません。
- **Sessionのコピー再送は専用APIのJSON本文**。ブラウザのCookieを復活させず、既存Sessionと同じPGlite・照合関数・期限判定・利用者状態で確認します。JWTは既存Profile APIへ同じBearerを送ります。通信記録に架空のCookie再送は表示しません。
- **最後の2問は説明モデル**。失効リストや複数サーバーは実装・起動していません。モデルの切り替えはAPI・DBに影響しません。実測のHTTP結果や性能として表示しません。
- JWTが期限切れになっていれば200にはならず、想定した比較の確認を保留します。発行からやり直せます。操作後の観測だけが失敗した場合は、操作を繰り返さず観測だけを再試行します。
- 図の配置・強調は説明モデル、表示するCookie・Session行数・送信値は選択した操作の実記録です。履歴を見返しても現在の状態は戻りません。

この構成ではJWTごとの有効状態を保存しませんが、JWT一般が失効不能という意味ではありません。個別の即時失効には失効リスト等の状態確認を追加できます。Sessionも共有ストアでスケールできます。方式の優劣を一律に決めず、照会負荷・鍵配布・失効情報の反映遅延などの条件から判断します。PGliteの本教材は単一Nodeプロセスであり、分散運用の実測ではありません。

### v1.7からの更新

1. 起動中のアプリを停止し、現在の作業を保存する。
2. Git利用時は`git pull --ff-only`。ZIPで移行する場合は新版を別フォルダーに置き、停止した旧版の`data/`をそのままコピーする（JWT署名鍵も含む）。
3. `npm ci` → `npm run dev`。
4. 右上の**v1.8**と**SessionとJWTの比較**の入口を確認する。

学習データの削除やDB移行は不要です。既存のignoreルール（`data/`・`data.bak-*/`）を維持しています。

## v1.7：JWTを「読む」と「信用する」を分ける（PHASE 7）

`/jwt` を開くと、1画面1問の「順番に学ぶ」から始まります。各問いで予想してから実行し、「まだわからない」でも進めます。点数・合否は付けません。既定は「やさしく」で、技術説明は「詳しく」や折りたたみの実行記録から確認できます。

- **基本3問**：JWT発行 → ブラウザだけでHeader / Payload / Signatureを分解 → 別操作でProfile取得。デコードしたclaimsは未検証と明示します。
- **失敗5問**：JWT発行 → roleの書換えで署名不一致 → 15秒JWT発行 → 同じJWTを保持して実時間で期限切れ → alg:noneを拒否。
- **自由に実験する**：発行する利用者・パスワードを変更し、5分／15秒JWT、分解、Profile、role変更、alg:noneを試せます。ガイドの実行記録も見返せます。
- **実データの観察**：実際のBearerヘッダー、HTTPステータス、joseの検証結果、DBの操作前後、公開鍵を確認できます。再生は追加通信を行いません。
- **結果から学ぶ**：予想が外れても先へ進めます。通信や観測に失敗した場合、または期待した種類と違う401だった場合は判定を保留します。最後に自分の言葉で説明する任意の振り返り欄があります。

### この教材のJWT方式

署名には **jose / RS256（2048bit）** を使い、APIはRS256だけを許可します。署名とiss / aud / exp / typ、必須claims、学習空間の一致を確認します。必要なclaimsが欠けているトークンも拒否します。

今回のJWTはJWS形式であり、**暗号化ではありません**。HeaderとPayloadは秘密鍵なしで読めます。Signatureは署名のバイト列です。JWTにはJWE形式もありますが、このPHASEでは扱いません。

JWTは**ブラウザの画面内メモリー**に保存し、Authorization: Bearerで送ります。Cookie・localStorage・sessionStorageには保存せず、画面再読み込みで消えます。これは教材の保存方式の選択であり、JWT一般の必須要件ではありません。実行履歴内にも教材用JWTのコピーが残りますが、同様に画面内だけです。

署名鍵は初回のJWT API利用時に生成し、`LAB_DATA_DIR/jwt-signing-key.json`（既定は`data/authlab/jwt-signing-key.json`）に保存します。秘密鍵のファイル権限は0600。秘密鍵はAPI・画面・ログには出さず、Gitにも含めません。再起動しても同じ鍵で検証します。データ移行ではこのファイルも含めて`data/`をコピーしてください。

発行時にはusersの本人確認を行いますが、**JWTごとの有効・無効の記録は作りません**。Profileの利用者属性は検証済みJWTの発行時点の値であり、ユーザーDBの最新状態は再照会しません。教材の学習空間確認・DB観察用のSQLは実行するため、「アプリ全体がDBへ一切アクセスしない」という意味ではありません。

JWTの`exp`は短命のAPIアクセス用トークンの期限（5分／実験用15秒）です。SessionのDB期限やCookie期限とは別物です。OAuthの認可フローやOIDCのID Tokenはまだ実装していません。

### v1.6からの更新

1. 起動中のアプリを停止する。
2. Git利用時は現在の作業を保存して`git pull --ff-only`。ZIP利用時は新版を別フォルダーに展開し、停止した旧版の`data/`をコピーする。
3. `npm ci` → `npm run dev`。
4. 右上の **v1.8** と **JWT認証** の入口を確認する（v1.8では比較教材も追加）。

DBスキーマの変更やデータ削除はありません。ロードマップの既存チェックも同じ保存キーで引き継ぎ、LEVEL 7のチェックを追加できます。

## v1.6：保存と一時利用を見分ける

学習中の図を改善しました。

- **ブラウザ＝保存**：Cookieとして保持している受付番号を表示します。
- **サーバー＝一時利用**：処理の再生中だけ、その処理で使っている番号を点線の枠で表示。結果の画面では番号を片付けて「処理終了」と表示します。画面の表示を片付ける動作であり、DBの記録を削除する操作ではありません。
- **DB＝記録**：受付番号・利用者・有効期限を対応表として表示します。期限切れでも記録が残っている状態、ログアウトで記録が消えた状態を区別できます。

DBもサーバー側の保存場所です。この図では、サーバーの処理とDBの記録を分けて表示しています。利用者は実際のSessionのuser_idとusersの対応から取得し、有効期限はその時点のDB値を日本時間で表示します。一般ユーザーはsample@example.com、管理者はadmin@example.comを示します。番号は短縮表示です。

PCでは対応表を横並びに、狭い画面では同じDBカード内で縦並びに表示します。見る場所は増やしていません。

## v1.5から継続：予想して、番号を追って、失敗から学ぶ

Session画面の「順番に学ぶ」に、次の3つを追加しました。

- **実行前の予想**：各問いで結果を予想してから実行。「まだわからない」も選べます。実験後に自分の予想と結果を比べます。点数や合否は付けず、予想が違っても先へ進めます。
- **失敗する実験のガイド**：間違ったパスワード → 正しいパスワード → DBだけ期限切れ → 番号を送っても401 → 再ログインで新しい番号、の5つの問いを案内します。基本ガイドの完了画面、または開始画面の「失敗する実験から始める」から進めます。
- **図の中で実際の番号を追う**：サーバーが作った番号がDBとCookieに保存され、次のアクセスで送られる様子を表示。実行記録から番号を取り出して短縮表示します。番号の移動アニメーションは読み進めた記録の説明で、実際の通信をその場で再実行するものではありません。動きを減らす設定にも対応しています。

期限切れの実験では **ブラウザとDBに同じ番号があるのに、DBの期限切れで利用を断られる** ことを確認できます。DBの期限だけを実験用に過去へ変更しており、ブラウザのCookieが自然失効するまで待つ操作とは区別しています。

結果の確認はCookie・DB・HTTPの実測値で行います。Cookieが消えたための401を、期限切れの番号を送ったための401と混同しません。通信などの問題で確認できない場合、予想へのフィードバックも保留し、再試行またはガイドの再開始を案内します。

どちらのガイドも開始すると、この学習空間のSessionと実行記録を初期化します。基本ガイドを終えて「自由に実験する」を選べば、記録を残したまま詳しく確認できます。

## v1.4から継続：1画面で、1つの問いを考える

Session画面は **「順番に学ぶ」** から始まります。「5分ガイドを始める」を押し、4つの問いを順番に確かめてください。

1. ログインすると、何が保存される？
2. 次のアクセスでは、何を送る？
3. ログアウトすると、何が消える？
4. ログアウト後も、情報を見られる？

各画面は **問い → 実行 → 図と短い説明 → 結果の確認** の順に進みます。緑のボタンが主な操作です。実行後の「次へ」は実際の記録の要点を読み進めるだけで、次のAPIを勝手に呼び出しません。「次の問いへ」を押してから次の実験を行います。

- ブラウザ・サーバー・DBの図、説明、操作を1枚のカードにまとめました。
- 保存・削除の結果では、Cookieの番号とDB件数を変更前／変更後で比較します。
- HTTPや全処理の記録、実際の番号は「詳しい記録を見る」から開けます。
- 4つの実験を終えたら、要点の振り返りと「失敗する実験」への入口を表示します。
- 確認通信に失敗した場合は先へ進めず、再試行できます。途中でSessionが使えなくなった場合は初めからやり直せます。
- **「自由に実験する」** に切り替えると、入力変更、スライダー、現在の状態、HTTP／DB等の詳細画面を使えます。学習で実行した記録も引き継ぎます。
- 自由実験から「順番に学ぶ」へ戻ると開始画面に戻ります。「5分ガイドを始める」を押すまでは、既存のSessionや実行記録を消しません。

初期表示に並べるのは1つの問いと操作です。学習画面では現在の状態と過去の記録を並べず、今読んでいる操作の記録だけを表示します。認証・DBの実装は従来どおりです。

## 実行記録と自由実験（v1.3から継続）

Session画面の「順番に学ぶ」で **「5分ガイドを始める」** を押してください。この学習空間のSessionと画面の実行記録を初期化し、次の4操作を案内します。ガイドは入力済みの一般ユーザーと5分の期限を使います。

1. **ログインする**：Sessionを発行し、確認APIで受け取ったCookieとDBの番号が一致したことを確認。
2. **自分の情報を見る**：パスワードを送らず、同じ番号でProfileの取得に成功したことを確認。
3. **ログアウトする**：DBから元の番号が削除され、確認APIにもCookieが届かなくなったことを確認。
4. **もう一度、自分の情報を見る**：CookieなしのProfile取得が401になることを確認。この拒否が正しい結果です。

ログインとProfile取得は、自由実験でも別々の操作です。状態確認用の `/api/lab/state` を各操作の直前・直後に呼びますが、Profileの自動取得はしません。

以下の詳細機能は「自由に実験する」にあります。

- **図と実行記録**：「次へ」・スライダー・処理ログ・順番の図・「見返す操作」の選択に合わせて、ブラウザ／サーバー／DBの現在位置と矢印を強調します。DBの追加・削除・更新も選択したステップから判定します。
- **変更前・変更後**：選んだ操作全体の前後で、Cookieの番号・DBの件数・番号と利用者と期限・ログイン判定を並べます。図の1ステップ分の差分とは区別して表示します。番号は短縮表示で、全桁の比較も開けます。
- **達成チェック**：ボタンを押しただけでは付かず、成功・失敗の種類と実際の値を検証して付きます。間違ったパスワード、DB期限切れ、権限不足も別々に確認します。理解そのものの自動採点ではありません。
- **過去と現在**：操作履歴を戻してもCookieやDBは巻き戻りません。右の状態欄は最後にサーバーで確認した現在の状態です。通信タブは選択した1回分を表示します。
- **確認失敗**：処理後の状態確認が失敗した場合、実行記録を残し、比較と達成判定を保留します。
- **保存範囲**：ガイド・操作履歴・自動チェックは画面内メモリーのみ。再読み込み・初期化でリセットされます。DBのデータと、ロードマップの自己申告チェックは従来どおり保存されます。

全体像の説明用の図と用語集は折りたたみで残しています。6つの詳しい役割も「6つの役割に分けて詳しく見る」から開けます。

## 自由実験の補助機能（v1.2から継続）

- 自由実験の「全体像と用語を確認する」を開くと、ブラウザ・サーバー・DBのつながりを図で表示します。
- 「最初のログイン」「ログイン後のアクセス」「ログアウト」「期限切れ」を切り替え、送る情報・返る情報・保存場所を比べられます。この切り替えは説明用で、実際のログイン状態は変更しません。
- パスワード画面には、本人確認だけに絞った図を表示します。
- 既定の「やさしく」では、各ステップを「何が起きた？」「なぜ必要？」「ここに注目」で説明します。「詳しく」で技術説明を表示できます。
- 実データは「実データと技術用語も見る」を開いて確認できます。受付番号のABC…は図だけの架空の例で、下のデータビューアは実際の値です。
- 画面内の用語集でCookie・Session・API・DB・認証・認可の意味を確認できます。

### 旧版からの更新

1. 起動中のターミナルでCtrl+Cを押してアプリを停止します。
2. 新しいZIPを別の場所に展開します。中の `auth-learning-lab`（`package.json` があるフォルダー）をVS Codeで開きます。
3. 必要なら停止後に旧フォルダーの `data` を新しいフォルダーへコピーします。コピーしなければ新しい学習データで始まります。
4. VS Codeの「ターミナル → 新しいターミナル」で `npm ci`、続いて `npm run dev` を実行します。
5. http://localhost:3000 を再読み込みし、右上にv1.9、Session画面に「順番に学ぶ」が表示されることを確認します。

## デモアカウント

| Role | Email | Password |
|---|---|---|
| user | sample@example.com | LearnSession!2026 |
| admin | admin@example.com | LearnSession!2026 |

画面には初期入力済みです。Passwordは入力欄でマスクし、DBにはbcryptハッシュのみを保存します。各ユーザー・学習空間でランダムSaltを生成するため同じPasswordでも保存値は異なります。実アカウントの資格情報を入力しないでください。

## 画面

| URL | 内容 |
|---|---|
| / | 全18レベルのロードマップ。1〜8が利用可能、以降は未実装と明示 |
| /password | Credential、Password照合、bcrypt、Salt、Hash。Sessionを発行しない |
| /session | 「順番に学ぶ」（予想付きの基本4問・失敗5問・番号を追う図）と「自由に実験する」（全記録・データビューア） |
| /database | このブラウザーの学習空間のusers/sessions実レコード |
| /jwt | 予想付き基本3問・失敗5問、JWT分解、実検証、自由実験 |
| /compare | SessionとJWTの比較。実測4問・設計モデル2問、コピー再送、自由実験 |
| /tokens | Access / Refresh。実験8問、更新・再利用検知・手動停止・DB期限変更 |

Refresh Token・OAuth等の未実装画面へのリンクは作りません。Architecture/Glossary専用ページはPHASE 18で追加予定。今回の説明はデモ内とこのドキュメントで提供します。

## 45分の学習コース

### 1. 本人確認とログイン状態の違い（8分）
1. Password認証ページで「実験を初期化」。
2. 「パスワードを照合」を実行。200成功になるがSessionは作られません。
3. 「自分の情報を見る（Profile API）」を実行すると401。「一度Passwordを確認できた」だけでは次のリクエストを本人と認識できません。
4. 間違ったPasswordで実行し、401とハッシュ照合結果を見る。

Identityは「誰か」、Credentialはその証拠。Authenticationは本人確認、Authorizationは何を許すかの判断です。

### 2. ハッシュの実体（7分）
1. Raw Dataでbcryptハッシュのalgorithm / cost / saltを見る。
2. Databaseのusersで2人のハッシュを比較。同じPasswordでも違うことを確認。
3. 「やさしく／詳しく」の説明を切り替え、bcrypt.compareの意味を読む。

Saltはハッシュごとの乱数で秘密ではありません。ハッシュは復号する暗号文ではありません。高速な汎用ハッシュだけでPasswordを保存しないこと、bcryptの入力上限が72バイトであることも確認します。本アプリは上限を超える入力を拒否します。

### 3. Sessionの13ステップ（15分）
1. Session認証ページで「自由に実験する」に切り替え、「ログインする」を実行。9ステップの記録が表示され、Profileはまだ取得しません。
2. 「自分の情報を見る」を別途実行すると4ステップが追加されます。「次へ」やスライダーで合計13ステップを確認。
3. STEP 6のSession IDをRaw Dataで見る。
4. STEP 7のDatabaseタブでsessionsを選ぶ。追加レコードが黄色になる。
5. STEP 8のSet-Cookieと、2件目のHTTPリクエストのCookieで同じIDを確認。
6. 最終ステップでSessionのuser_idからUserを特定できたことを確認。
7. 再ログインするとIDが変わり、旧Sessionは削除される。リロードしても新Cookieが有効な間はログインが続く。

**「次へ」は実行済み記録の再生です。サーバー処理を一時停止していません。** 右側は最後にAPIで観測した現在の状態、Databaseタブは選択したステップ時点のスナップショットです。「選択ステップのDBを表示」を外すと現在状態になります。

### 4. 期限切れ・Logout・認可（10分）
1. 「DBの期限を切らす」→Profile。Cookieは残っていても、DB期限が過去なので401。
2. 15秒を選んでログイン→15秒以上経過後にProfile。自然失効を確認。ブラウザーもExpiresに従ってCookieを削除するため、Cookieなしになる場合があります。
3. userでログイン→Admin APIは403。本人確認は成功、権限不足。
4. adminでログイン→Admin APIは200。
5. Logout→Profileは401。DBレコードとCookieの両方を削除する理由を説明。

### 5. 最後の問い（5分）
- CookieにはUserの全情報が入っている？ → この方式ではランダムIDだけ。
- SessionはBrowserにある？ → サーバーのDBにも対応表がある。
- Cookieがあれば必ず認証済み？ → 存在・期限・ユーザー状態のサーバー検証が必要。
- HttpOnlyならXSSを防げる？ → CookieのJS読み取りを防ぐ設定であり、XSS全般や不正操作を防ぐわけではない。
- BrowserのCookieだけを削除すれば十分？ → 漏えい済みIDを無効化するにはサーバー側失効も必要。

## Architectureと責務

React UI → Next.js Route Handler → Authentication Domain → PGlite（同じNode.jsプロセス、ローカルファイル永続化）。

- **User**: 資格情報を入力。
- **Browser**: Cookieを保存し、条件に合うHTTPリクエストに自動添付。
- **Client Application**: React画面。APIを呼び、記録を可視化。
- **Authentication Server**: User検索、Password検証、Session発行。
- **Resource API**: Profile/Admin。毎回Sessionを検証し、必要なroleを確認。
- **Database**: users/sessionsの永続化。

Authentication ServerとResource APIは同じNext.jsプロセスにあり、外部IdPはありません。責務はコード・イベント・画面で区別しています。設計図・Sequence・将来比較設計は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## API

| Method | Endpoint | 挙動 |
|---|---|---|
| POST | /api/lab/init | 学習空間と2ユーザーを初期化、lab_space Cookie設定 |
| POST | /api/password | 資格情報照合のみ。Session未発行 |
| POST | /api/login | 資格情報照合→Session生成/ローテーション→Set-Cookie |
| GET | /api/profile | Session照合。成功200、未認証401 |
| GET | /api/admin | Session照合＋admin認可。権限不足403 |
| POST | /api/logout | 現在のSessionを削除＋Cookie削除 |
| POST | /api/lab/expire | 教育操作でDB期限を過去へ。Cookieは変更しない |
| POST | /api/lab/reset | 自分の学習空間のSessionを全削除 |
| GET | /api/lab/state | 現在状態・教材DBの観察 |
| POST | /api/jwt/issue | 実Password照合→RS256署名付きJWT発行。Sessionは作らない |
| GET | /api/jwt/profile | Bearerの署名・claims検証。成功200、無効401。検証済みの発行時属性を返す |
| POST | /api/compare/session-replay | JSONのsessionIdを同じ学習空間の実DBで照合。Cookieは変更しない。成功200、記録なし／期限切れ／利用者無効は401 |
| POST | /api/tokens/issue | 実Password照合→Access JWT / Refresh発行。Sessionを変更しない |
| GET | /api/tokens/profile | Accessの署名・claimsを検証。Refresh停止状態による即時失効はしない |
| POST | /api/tokens/refresh | ハッシュ照合→使用済み化＋新規発行。再利用なら系列全体を停止 |
| POST | /api/tokens/revoke | 指定Refreshの系列を停止。Accessの署名・期限は変えない |
| POST | /api/tokens/expire | 実験用に指定系列のDB期限だけを過去へ変更 |
| GET | /api/tokens/state | 同じ学習空間のRefresh Family・世代・ハッシュを実観察 |

全APIにX-Lab-Request: 1が必要。POSTはOriginがAPP_ORIGINに完全一致し、Content-Type: application/jsonが必要。ユーザー不存在とPassword不一致は同じエラーにします。

## Database Schema

| テーブル | 主要カラム | この版の扱い |
|---|---|---|
| lab_spaces | id, created_at | ブラウザーごとの学習空間 |
| users | id, lab_id, email, password_hash, role, status, created_at | bcrypt Cost 12 |
| sessions | id, lab_id, user_id, expires_at, created_at | 256bitランダムID、絶対期限 |
| refresh_families | id, lab_id, user_id, expires_at, revoked_at, revoke_reason | 更新系列の期限と停止状態 |
| refresh_tokens | id, lab_id, user_id, family_id, generation, token_hash, expires_at, used_at, revoked_at | 各世代のハッシュと使用／停止状態 |
| oauth_clients | client_id, lab_id, client_name, redirect_uri | 空の予約スキーマ |
| authorization_codes | code, lab_id, client_id, user_id, expires_at | 空の予約スキーマ |

定義はdb/schema.sql。sessionsのlab_id/user_id複合外部キーで異なる空間のUserへの紐付けを防ぎます。すべてのユーザー由来のSQL値はパラメーター化。DBの初期化Promiseをプロセス内で共有し、HMR時のDB多重作成を防いでいます。PGliteのtransactionコールバックでトランザクションの混在を防ぎます。

## 観察データの読み方
- **HTTP**: 実行したリクエストとサーバー発行の主要ヘッダー。低レベルの全パケット記録ではありません。
- **Browser State**: 受信Cookie＋サーバー設定。HttpOnly CookieをJSから直接取得していません。CookieリクエストにExpires属性は載らないため不明と表示する場合があります。
- **Database**: 実SQL結果のスナップショット。黄色は記録間で追加・変更されたレコード。
- **Server Logs**: 今回の実行イベント。選択するとフローの同じステップへ移動。Browser動作の説明イベントは実行ログと区別。
- **Sequence**: 資格情報検証と保護APIの通信を分けて表示。選択ステップと連動。
- **Raw Data**: 実Session ID、bcrypt Hash、生成者・保管先・用途・期限。IDが出現するステップへ移動可能。

## Securityと本番との差
このアプリは**個人のローカル学習用**です。起動スクリプトの待ち受け先は127.0.0.1、LAB_MODE=trueでのみAPIが有効です。外部公開・実ユーザー登録を想定していません。

Session ID・Password Hash・DBスナップショットを教材レスポンスで返すため、通常の製品認証APIより意図的に多くの情報を公開します。この観察機能はHttpOnlyを迂回してCookieをJSで読む機能ではなく、サーバーが教材用に同値を返しているものです。本番に転用する際は観察APIを除去し、認証試行制限・監査・秘密管理・TLS・期限切れレコード清掃・運用設計を追加する必要があります。本版はログイン試行のレート制限、Password回復、登録、MFAを提供しません。

Cookie: HttpOnly / SameSite=Lax / Path=/ / host-only。HTTP localhostではSecure=false。HTTPSではCOOKIE_SECURE=true必須。Cookieが漏れると本人として使われ得るため、実運用ではIDをログや画面に出しません。Passwordの平文はDB・trace・ログに保存しません。

## 検証コマンド

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run verify:portable
```

`verify:portable`は納品版と同じPGlite構成を一時ディレクトリーで起動し、ドメイン・HTTP・ブラウザー操作を検証します。さらにアプリを再起動し、users・Password Hash・Session・JWT署名鍵が残ること、同じJWTが本番・開発サーバーで検証できることを確認します。Refreshのハッシュ・系列・使用履歴の永続化、再起動後の更新と再利用検知も確かめます。一時データは終了時に削除されます。普段の学習データには触れません。今回と過去の結果は [docs/VERIFICATION.md](docs/VERIFICATION.md) に分けて記録しています。

ブラウザーを省略する場合は `SKIP_BROWSER=true npm run verify:portable`（macOS/Linux）。Windows PowerShellでは `$env:SKIP_BROWSER="true"; npm run verify:portable`。

別途起動中のアプリへのテストは `npm run test:integration` と `npm run test:browser` で実行できます。

## Directory Structure
```text
src/app/             ページ・Route Handler・CSS
src/components/      Dashboard / Lab / Flow / Inspectors
src/lib/auth.ts      ユースケースと認証イベント
src/lib/password.ts  bcryptと入力検証
src/lib/jwt*.ts      JWT発行・検証・鍵保存・学習の問いと判定
src/lib/compare*.ts  比較のAPI呼出し・問い・観測値の一致確認
src/lib/tokens*.ts   Access / Refreshの型・API呼出し・学習判定
src/lib/refresh-store.ts  Refresh発行・ローテーション・系列停止
src/lib/store.ts     PostgreSQL永続化とSession操作
src/lib/http.ts      Cookie・Origin/Host検証
src/lib/types.ts     表示とイベントの共通型
db/schema.sql        DBスキーマ
docs/                設計・ADR・検証結果
tests/               ドメイン・HTTP・ブラウザーテスト
scripts/             DB内蔵構成の検証
```

## ロードマップ（PHASE 9のみ今回追加）

| 概念 | 主なポイント | PHASE |
|---|---|---|
| JWT（実装済み） | Header/Payload/Signatureを分解。署名・claims・失敗実験 | 7 |
| Session vs JWT（実装済み） | ログアウト後の実再送比較、即時失効・増設の説明モデル | 8 |
| Access / Refresh Token（実装済み） | 期限切れ・ローテーション・再利用検知・系列停止を実測 | 9 |
| OAuth 2.0 | ClientへのAPIアクセス認可委譲。単独では認証規格ではない | 10 |
| PKCE | verifier/challengeで認可コードと交換要求を結び付ける | 11 |
| OIDC | OAuth上の本人確認。ID Token、openid、nonce、UserInfo | 12 |
| OAuth vs OIDC | Access Tokenの用途とClientが検証するID Tokenの違い | 13 |
| SSO（OIDC / SAML） | IdPと各アプリのSession、SAML AssertionとID Tokenの比較 | 14 |
| MFA | Password以外の独立した要素を組み合わせる | 15 |
| Passkey | 端末側の秘密鍵でChallengeに署名、Serverは公開鍵で検証 | 16 |
| Security Lab | Session Hijacking/Fixation/CSRF/XSS等の閉じたシミュレーション | 17 |

## 参考資料
- [Next.js Cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [PGlite API](https://pglite.dev/docs/api)
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)

## 検証
今回の実行結果と過去の記録は [docs/VERIFICATION.md](docs/VERIFICATION.md) で区別します。`npm run test`、`npm run build`、`npm run typecheck`、`npm run verify:portable`で確認できます。ブラウザ検証には`npx playwright install chromium`が必要です。verify:portableは一時DBを作成し、学習用のdata/を変更しません。

今回の追加範囲はPHASE 9です。次に10〜11、12〜13を順に実装し、PHASE 13までを目標とします。PHASE 14でSAMLを扱う合意とPHASE 10の参考資料は [docs/ROADMAP.md](docs/ROADMAP.md) に記録しています。
