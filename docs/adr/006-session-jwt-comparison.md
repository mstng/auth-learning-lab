# ADR 006: PHASE 8 SessionとJWTの比較

状態: 採用。v1.8でPHASE 8のみ追加する。

- `/compare`に予想付き6問を追加。発行・通常アクセス・ログアウト・コピー再送を実測し、即時失効・複数サーバーを説明モデルで考える。既存のSession/JWT教材・認証API・DBスキーマは変更しない。
- 発行・Profile・ログアウトには既存APIを使う。Sessionのログインは現在のSessionを置き換えるため実行前に明示する。JWTは既定5分。JWTのexpとSessionの期限は同じ値の期限として扱わない。
- 発行時のSession IDとJWTを画面内に実験用コピーとして残す。Session IDは教材APIの観測値から取得し、HttpOnly CookieをJavaScriptで読んだとは説明しない。コピーも履歴も永続化しない。
- Sessionのログアウトは既存APIによるDB行・Cookie削除。JWTのログアウトはこの画面の通常利用用JWTを手放す操作。JWTの失効APIは実装していない。実験用コピーは別に残ることを常時明示する。
- ブラウザfetchでCookieヘッダーを偽装しない。`POST /api/compare/session-replay`へコピーしたSession IDをJSONで送り、既存Sessionと同じPGlite・findSession・isSessionValidとusers.statusで実際に照合する。HTTP記録はこの実リクエスト。Cookieを復活・再送したような記録を作らない。LAB_MODE・Host・Origin・学習空間・入力形式を検証し、別空間のIDを拒否する。
- JWT再送は既存の`GET /api/jwt/profile`。改ざんしない同一トークンがログアウト後も期限内なら200となる。期限切れ等の401を想定した比較の成功と取り違えない。
- 達成条件は前問からのID/トークンの連続性、実送信値、Cookie・DBの操作前後、拒否理由を検証する。観測だけが失敗した場合は観測を再試行し、ログアウトを二重に実行しない。
- 図のブラウザ保存・サーバー一時利用・DB記録を2方式で並べる。過去記録の再生は状態やAPIを再実行しない。各値の観測時点を明示し、サーバーの表示終了はメモリー消去と区別する。
- 失効リスト、共有Session Store、検証サーバー2台は説明モデル。クリックで比較するがHTTP成功・実性能・DBゼロ回といった架空の実測値は出さない。現在のPGliteアプリは単一プロセスである。
- JWTの自己完結性はJWTごとの有効状態を照会しない設計について説明する。鍵・許可条件・時計・観察用DB・学習空間は別に必要。即時の個別失効には失効リスト等の状態確認を追加できるが、共有・反映遅延の設計も要る。Sessionも共有ストアを使ってスケールできる。優劣を一律に決めない。
- Refresh Token・OAuth・OIDC・SSO/SAMLは今回未実装。PHASE 13目標、PHASE 10指定資料、PHASE 14 SAMLの合意を維持。

参考: [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725)、[OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)。
