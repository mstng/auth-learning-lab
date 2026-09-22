# ADR 007: PHASE 9 Access / Refresh Token（v1.9）

採用日: 2026-09-22。PHASE 10以降は今回実装しない。

## 学習の問い

`/tokens`に独立した8問のガイドと自由実験を追加する。予想の選択肢は結果のみを示し、理由は実行後に読む。「まだわからない」を選べ、予想の正否で進行を止めず、点数を付けない。結果→3か所の図→実行記録→理由の順。図の配置と強調は説明用、値・HTTP・DBの前後は実観測と明示する。

1. 2種類を発行するとDBに何が残るか。
2. RefreshをProfileへ送れるか。
3. Refreshがあれば期限切れAccessでも使えるか。
4. 更新でどの値が変わるか。
5. 新しいAccessでProfileを取れるか。
6. 使用済みRefreshの再利用で何が止まるか。
7. 最新Refreshでも更新できるか。
8. 更新停止後の同じAccessが、期限内ならまだ使えるか。

## 実装

- Accessは既存のjose / RS256・鍵保存・iss/aud/exp/typ/claims検証を再利用。JWTの個別状態や失効リストは追加しない。最初の15秒は実時間で失効させ、更新後は5分。既存SessionのDB/Cookie期限とは独立する。
- Refreshは`node:crypto.randomBytes(32)`の不透明な256bit乱数。JWTを使わない。DBは標準SHA-256でハッシュ化した値のみ保存。パスワードのような低エントロピー入力ではないためbcryptではない。暗号アルゴリズムを自作しない。
- 同じ初回発行からのToken Familyを`refresh_families`で管理。各世代の`refresh_tokens`にハッシュ・世代・使用日時・停止日時を残す。更新時に使用済み化と新規発行を同一トランザクションで行い、署名失敗でもロールバックする。
- 再利用検知時は系列全体を停止。既に停止済みなら`revoked`、初めて使用済みを検知したときは`reused`を教材結果として区別する。正規利用者と第三者の識別ができたとは表示しない。同時更新／応答消失後の再送でも停止し得る。自動リトライ・自動更新は実装しない。
- Refreshの有効期間は初回発行から30分の絶対期限。ローテーションで延長しない。操作時に期限を判定するので、期限到来時にDBの行やブラウザの値が消えるわけではない。
- 更新は現在の利用者の有効状態を照会する。Profileは発行済みAccessの署名とclaimsを検証し、Refresh Familyの現在状態でアクセスを止めない。観察用DB照会は認証判断と区別する。
- 手動の系列停止、DBのRefresh期限を過去にする操作も自由実験に用意。後者は自然失効の演出ではなく実DBを変更する実験と明示する。
- 発行は既存サンプル利用者の実bcrypt照合から始める教材用API。OAuth Password GrantやAuthorization Code Flowを実装したとは扱わない。クライアント登録・同意・scope・OAuth形式のエラー／Token EndpointはPHASE 10以降。

## 保存とHTTPの境界

2種類の平文と実験用コピー／履歴は画面内メモリーのみ。Cookie/localStorage/sessionStorageには保存しない。本番向けのブラウザ保存方式の推奨ではない。リロードで画面の値は消えるがDBの系列は残り、発行し直すと別系列となる。古い系列を黙って削除しない。

Accessは`Authorization: Bearer`でProfile窓口へ、RefreshはJSON本文で更新窓口へ送る。学習用のHTTP記録には実際に送った値が含まれる。平文RefreshをDB・サーバーログへ書かず、秘密鍵はAPIに返さない。既存のLAB_MODE/Host/Origin/Content-Type/custom headerガードとlab_id分離を全ルートに適用する。

応答を確認できないときは、成功を表示せず自動再送しない。応答が失われても操作済みの場合があるため、新規発行からやり直せる。原子的DB処理はネットワーク応答の一度限りの受領を保証するものではない。

## 互換性・対象外

DB変更はテーブル・列・インデックスの追加のみ。旧予約行は消さず、family_idがあるPHASE 9の行を学習観察対象とする。Session・JWT・比較のAPI／教材は維持。共通DB Viewerの予約Refresh欄だけ実データ観察へ拡張する。既存の進捗保存キー、dataとバックアップのignoreルールを保持する。

PGliteは単一プロセス。トランザクションの並行リクエストは検証するが、複数サーバーでの運用性能、DPoP/mTLS、ネットワーク再試行の猶予期間、Token清掃、OAuth/OIDC、即時Access失効、汎用認証基盤は対象外。

## 根拠

[RFC 9700 §4.14 Refresh Token Protection](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)のローテーション・関連付けの保持・再利用時の停止を参考にする。この教材専用APIをOAuth準拠実装と呼ぶ根拠にはしない。
