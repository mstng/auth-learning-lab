# ADR 004: 将来プロトコルの設計方針（未採用・未実装）
- JWT Algorithm: 非対称署名を優先検討。採用時にRS256/ES256等を固定し、検証ライブラリでiss/aud/expとアルゴリズムを制限。独自暗号は書かない。
- Token Expiration: Access Tokenは短命、Refresh Tokenはより長命。学習に適した秒数を別途定義。Sessionの期限と混同しない。
- OAuth Flow: Authorization Code Flow。Mock Authorization Serverを独立した責務として追加。
- PKCE: S256を使う。verifierをcodeに紐づけ、交換時の照合とcodeの一回限り利用をトランザクションで保証する。
- Refresh Token Strategy: ハッシュ保存・ローテーション・再利用検知・Token Family単位の失効を検討する。

本版ではJWT発行やOAuthを実装したと見せるUI、ダミーのトークンを成功扱いするAPIは提供しない。

PHASE 7でJWT部分を採用。具体化した判断は[ADR 005](005-jwt-learning.md)。OAuth以降は引き続き未実装。

PHASE 9でRefreshのハッシュ保存・ローテーション・再利用検知・Family停止を採用。期限・教材用HTTPの境界は[ADR 007](007-access-refresh-tokens.md)。OAuthの認可フローは引き続き未実装。
