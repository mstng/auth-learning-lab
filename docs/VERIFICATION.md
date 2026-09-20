# v1.2 UI改善の検証

検証日: 2026-09-19

- Next.js本番ビルドとTypeScript型検査に成功。
- 実際の組み込みPGliteを使う本番サーバーで、Playwrightの既存3シナリオを更新してすべて成功（約39秒）。
- 図の4場面切り替えが説明だけを変え、ログイン状態を変更しないことを確認。
- 「やさしく／詳しく」で説明と実データの初期表示が変わることを確認。
- ログインの13ステップ、HttpOnly Cookie、DB変更表示、ログ・順番の図との連動、403、DB期限切れ401、ログアウトを確認。
- 15秒の自然失効、パスワード照合だけではSessionを作らないこと、ロードマップ保存、画面遷移を確認。
- PC 1600pxとスマートフォン390pxのスクリーンショットを確認。ページ全体の横はみ出しなし、Sessionフローの未処理JavaScriptエラーなし。
- 今回はUIと説明文の改修。以下のv1.1でのドメイン・HTTP統合・再起動の検証は過去の結果で、今回の再実行には含めない。

---

# PHASE 1〜6 検証結果 — v1.1 Docker不要版

検証日: 2026-09-18

## 結果

| 項目 | 結果 |
|---|---|
| Next.js production build / TypeScript strict | 成功 |
| npm start / Standalone server起動 | 成功 |
| ドメインテスト3件 | 成功 |
| HTTP統合テスト2件 | 成功 |
| Playwrightブラウザーテスト3件 | 成功 |
| PC 1600px / Mobile 390px | 表示確認済み、意図しないページ全体の横スクロールなし |
| ブラウザーの未処理JavaScriptエラー | Sessionフローのテストで0件 |
| アプリの再起動後にusers・Hash・Sessionを保持 | 成功 |
| npm run devで同じ保存データを利用 | 成功 |
| Docker・外部DB | 不要 |

## 検証した動作

- bcrypt照合、異なるSalt、Password長上限、期限判定の境界値。
- Password照合のみではSessionを発行しない。
- 未認証Profileは401、不正Passwordも401、新しいSessionは作らない。
- Session ID生成、DB保存、HttpOnly/SameSite属性、ブラウザーCookieの実保存。
- document.cookieから認証Cookieを読めないこと。
- Login→Profileの9＋4＝13イベントと実際のCookie送信。
- 再ログイン時のID更新・古いIDの拒否。
- 別の学習空間からのSession利用拒否。
- userのAdmin APIは403、adminは200。
- DB期限変更後の401、15秒経過による自然なCookie失効と未認証化。
- Logout時にCookieとDBレコードの両方を削除、削除後のID再利用拒否。
- リロード後のSession継続。
- 同一Origin制約、Content-Type、入力不正、メソッド不正、存在しないAPI。
- レスポンス・イベントにPassword平文が含まれない。
- DBの履歴スナップショット、追加レコードのハイライト。
- Logs / Raw / Sequenceの選択とステップ表示の連動。
- ロードマップの学習済みチェックの端末内保存、画面遷移。

## 実行環境と限界

標準納品構成はNext.js 16.3.5 / React / TypeScript strict / 組み込みPGlite。Node.js 24で検証。
PGliteを同じNode.jsプロセス内で起動し、ファイルシステムへ永続化。検証でも納品版と同じ構成を使用しており、DB・APIのモックではない。Docker、独立したDBプロセス、DB用TCPサーバーは使用していない。
ブラウザーはChromium + Playwright。環境の都合で検証用Chromiumバイナリを使用。学習アプリのOrigin/Cookie検証を無効化する変更は行っていない。

`npm run build`後に`npm run verify:portable`で再現可能。標準の起動手順は`npm ci`と`npm run dev`。`.env`なしで動作を確認した。再起動テストは本番用プロセスを停止して再起動し、同じCookieで同じSessionを照合。その後、開発用プロセスでも同じ保存データを照合した。

## 画面

- screenshots/session-preview.png: Session学習画面の最初の表示範囲
- screenshots/session-desktop.png: PC全体
- screenshots/mobile.png: スマートフォン全体
- screenshots/dashboard.png: ロードマップ

## PHASE対応

1. Project Setup: Next.js/React/TypeScript strict、Node.js起動スクリプト、PGlite内蔵、SQLスキーマ。
2. Dashboard/Learning UI: 18レベルのロードマップ、1〜6の学習リンクと完了チェック。
3. Password Authentication: bcrypt、Salt/Cost解説、成功/失敗、Session非発行の照合API。
4. Session Authentication: ID発行、Cookie、保護API、ローテーション、失効、Logout、基本認可。
5. 今どこ: 6つの責務、現在位置、From/To/Data/Protocol、ステップ・Sequence・ログ連動。
6. Inspectors: HTTP/DB/Browser/Rawの実値、履歴と現在状態の区別、DB変更ハイライト。

JWT以降は本版の対象外。拡張設計のみDESIGN.mdとADRに記載。
