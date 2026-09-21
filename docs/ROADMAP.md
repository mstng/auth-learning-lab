# Authentication Learning Lab 合意済みロードマップ

更新: 2026-09-21

- PHASE 1〜6はv1.6で完成。追加改善案を未完了タスクに戻さない。
- v1.7でPHASE 7、v1.8でPHASE 8まで完成。PHASE 9以降も段階ごとに実装する。
- 当面の完成目標はPHASE 13。予想→実行→観測→説明を全段階で継承する。
- PHASEと画面のLEVELは別の番号体系。

| PHASE | 実装単位 | 問い |
|---|---|---|
| 7 | JWT | なぜ読めるのに改ざんして使えないのか |
| 8 | Session vs JWT | なぜログアウトと即時失効が一致しないのか |
| 9 | Access / Refresh Token | なぜ二種類に分け、更新時に入れ替えるのか |
| 10〜11 | OAuth 2.0 / PKCE | なぜ認可コードを経由し、交換要求と結び付けるのか |
| 12〜13 | OIDC / OAuth vs OIDC | なぜAPIアクセスの許可とログイン証明を分けるのか |
| 14 | SSO（OIDC + **SAML**） | IdPと各アプリのSessionはどう違い、なぜ別アプリで再ログインを省けるのか |

## PHASE 10の指定参考資料

ユーザー指定: [＠IT「OAuth」の基本動作を知る](https://atmarkit.itmedia.co.jp/ait/articles/1208/27/news129.html)（[2ページ目](https://atmarkit.itmedia.co.jp/ait/articles/1208/27/news129_2.html)）。

具体的なサービス連携から始め、登場人物、クライアント登録、認可要求、認証・同意、認可コード、Token交換、APIアクセスを順に教材化する。初版当時の説明を含むため、実装時には現行のRFCとOAuthセキュリティ指針に照らす。教材ではAuthorization ServerとResource Serverの責務を分ける。

## PHASE 14のSAML

OIDC SSOとSAML SSOを並べて扱う。IdP / SP、SAML Request / Response、Assertion（XML）、署名検証、IdPとアプリのSession、ID Tokenとの違いを観察対象にする。閉じたローカルの教材とし、暗号・XML署名を自作しない。現段階では計画のみで、実装済みと表示しない。
