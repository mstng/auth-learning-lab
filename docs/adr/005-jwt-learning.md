# ADR 005: PHASE 7 JWTを実測から学ぶ

状態: 採用。PHASE 7のみ実装し、PHASE 8以降は別の段階で扱う。

- `/jwt` と `/api/jwt/[operation]` を追加する。既存SessionのAPI、ガイド、図、説明は変更しない。
- joseのRS256（2048bit）で署名し、検証側はRS256だけを許可。iss/aud/sub/iat/exp/jti/labの存在、iss/aud/exp、typ、利用者属性と学習空間を検証する。独自暗号実装はしない。
- 鍵は初回利用時に生成し、LAB_DATA_DIR内のjwt-signing-key.jsonに権限0600で永続化する。再起動は失効操作ではない。秘密鍵はAPI・画面・ログへ出さない。
- JWTはブラウザの画面内メモリーに保持。Cookie/localStorage/sessionStorageには保存しない。Authorization: Bearerで送る。保存手段はJWTの必須要件ではなく教材上の選択。
- 発行では既存usersを照会するが、JWTごとの有効状態はDBへ保存しない。Profileの認証判断は署名・claimsで行い、ユーザーの最新statusをDBへ再照会しない（発行時の属性）。学習空間の存在確認・観察用DBスナップショットは別の目的のSQLとして明記。
- 署名付きclaimsのlabには学習空間CookieのSHA-256ダイジェストを入れ、他空間での利用を拒否する。空間Cookieだけでは認証済みにならない。
- 既定300秒、期限切れ実験15秒。Access TokenのexpとSession期限を別扱いにする。自然失効は同じ実トークンをサーバーの現在時刻で検証し、Payloadの書換えで代用しない。
- 基本ガイド3問（発行・デコード・Profile）、失敗ガイド5問（準備発行・改ざん・短命発行・自然失効・alg:none）。全て実行前に予想し、点数や合否は付けない。復号という表現は使わず、JWSのデコードと信頼判断を分ける。
- API応答の実行記録、ブラウザで実行したデコード・編集・メモリー保持、移動を表す説明図を区別する。記録の再生は追加のAPIアクセスを起こさない。通信・観測失敗や予期しない拒否は学習結果として成功扱いしない。
- 自由実験は同じ実APIを使う。失敗ガイド用編集は公開可能なデモJWTに限定。Sessionの初期化は呼ばない。
- PHASE 8のログアウト再送比較、PHASE 9のRefresh Token、PHASE 10以降のOAuth/OIDCは未実装。

参考: https://github.com/panva/jose 、https://www.rfc-editor.org/rfc/rfc8725 、https://www.rfc-editor.org/rfc/rfc7519
