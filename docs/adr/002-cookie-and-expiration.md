# ADR 002: Cookie設定と期限
採用。認証Cookieはlab_session、HttpOnly、Path=/、SameSite=Lax、Domain未指定（host-only）。5分の絶対有効期限、実験用に15秒を選択可能。CookieのExpiresはDBのexpires_atと発行時に一致させる。DB期限が認証判断の権威。延長・アイドルタイムアウトは今回未実装。

HTTP localhostではSecure=false。HTTPSではCOOKIE_SECURE=trueを必須とし、falseならAPIを拒否する。SameSiteだけでCSRFを防いだとみなさず、Origin、Host、Content-Type、カスタムヘッダーを検証する。

初期化は現在の学習空間のSessionだけを削除する。別ブラウザーのデータやデモユーザーは削除しない。ログアウトもDB削除とCookie削除の両方を実施する。
