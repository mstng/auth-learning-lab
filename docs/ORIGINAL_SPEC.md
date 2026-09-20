あなたは、Web認証・Identity・セキュリティに精通したシニアソフトウェアエンジニア兼アーキテクトです。

「認証システムの仕組みを、実際に動くWebアプリケーションを操作しながら理解するための学習アプリ」を開発してください。

単なるログイン機能ではなく、

**認証処理の内部で何が起きているのかを可視化すること**

を最重要要件とします。

# ゴール

このアプリを30分〜1時間操作することで、エンジニアが以下を自分の言葉で説明できる状態を目指してください。

- Authenticationとは何か
- Authorizationとの違い
- Password認証の仕組み
- Password Hashing
- Cookie
- Session
- JWT
- Access Token
- Refresh Token
- OAuth 2.0
- OpenID Connect
- Authorization Code Flow
- PKCE
- IdP
- Authorization Server
- Resource Server
- Client
- SSO
- MFA
- Passkey / WebAuthn
- ログアウト
- Session / Tokenの期限切れ
- Token失効
- 401 / 403
- CSRF
- XSS
- Session Hijacking
- JWT改ざん

ただし、今回は認証を主目的とします。

認可については、

- Authenticationとの違い
- role=user / admin
- 401 Unauthorized
- 403 Forbidden

程度の基本実装に留めてください。

高度なRBAC / ABAC / Permission管理は将来拡張可能な設計だけ残し、今回は実装しなくて構いません。

# 技術スタック

以下を基本としてください。

Frontend / Backend:

- Next.js
- React
- TypeScript

Database:

- PostgreSQL

開発環境:

- Docker
- Docker Compose

必要に応じてORMを利用して構いません。

UIライブラリについても適切なものを選択してください。

TypeScriptはstrict modeとしてください。

# このアプリの最重要コンセプト

通常の認証アプリでは、

ユーザー
↓
ログイン
↓
成功

しか見えません。

このアプリでは、

ユーザー操作

↓

Browser

↓

HTTP Request

↓

Application

↓

Authentication Server

↓

Database

↓

Authentication処理

↓

HTTP Response

↓

Cookie / Token保存

という内部処理をすべて観察できるようにしてください。

# 主要コンポーネント

常に以下を区別して表示してください。

User

Browser

Client Application

Authentication Server / IdP

Resource Server / API

Database

どこで処理が実行されているのかを、画面上で明確にしてください。

# 学習体験の中核機能

このアプリでは以下の4機能を重要機能として実装してください。

単なる付加機能ではなく、認証を理解するための主要なUXとして扱ってください。

## 1. 「今どこ？」表示

認証処理では、

User

Browser

Client Application

Authentication Server / IdP

Resource Server

Database

のどこで処理が行われているのか分からなくなりやすいため、

現在処理中のレイヤーを常に明示してください。

例：

現在位置：

Authentication Server

処理：

Password Hashを検証中

Data Flow Diagram上でも現在のコンポーネントを強調表示してください。

さらに、

FROM

Browser

TO

Authentication Server

DATA

email
password

PROTOCOL

HTTPS

のように、

「どこからどこへ何が流れたか」

を常に確認できるようにしてください。

Stepを進めるたびに、

Current Location

Source

Destination

Data

Protocol

Action

が更新されるようにしてください。

## 2. Session vs JWT 比較モード

Session認証とJWT認証を別々に学ぶだけではなく、

同じ操作を左右に並べて比較できる画面を作ってください。

例：

「ログイン後に /mypage を表示する」

という同じ操作を比較します。

SESSION

Browser

↓

Cookie

↓

Application

↓

Session ID取得

↓

Session Store

↓

User特定

JWT

Browser

↓

Authorization: Bearer

↓

Application / API

↓

JWT Signature Verification

↓

Claims確認

↓

User特定

左右比較画面では最低限以下を比較してください。

- Browserが保持するもの
- Serverが保持するもの
- Requestで送信するもの
- Authentication Stateの保存場所
- Logout時の処理
- Expiration
- Revocation
- Scalability上の違い
- Security上の注意点

ただし、

「SessionよりJWTが優れている」

「JWTよりSessionが優れている」

という単純な結論にはしないでください。

それぞれの設計上の違いとTrade-offを説明してください。

## 3. OAuth 2.0 vs OpenID Connect 比較モード

OAuth 2.0とOpenID Connectは混同されやすいため、

比較専用画面を作ってください。

OAuth 2.0

目的：

Delegated Authorization

主に扱うもの：

Access Token

問い：

「このClientにAPIへのアクセスを許可してよいか？」

OpenID Connect

目的：

Authentication / Identity

主に扱うもの：

ID Token

-

Access Token

問い：

「このUserは誰か？」

同じAuthorization Code Flowを利用した場合でも、

OAuth

Authorization Code

↓

Access Token

OIDC

Authorization Code

↓

Access Token

-

ID Token

となる違いを視覚化してください。

以下も比較してください。

OAuth:

scope=read\_profile

OIDC:

scope=openid profile email

ID Tokenが存在する意味、

UserInfo Endpoint、

sub、

iss、

aud、

nonce

についても比較画面から確認できるようにしてください。

## 4. 認証データの「実物」を見る機能

学習環境内で生成されたデータは、

可能な限り実際の値を表示してください。

本番のSecretではなく、

このLearning Lab内だけで利用するダミーデータです。

例えば、

Session ID

abc123xyz...

Authorization Code

SplxlOBeZQQYbYS6WxSbIA

Access Token

eyJhbGciOi...

Refresh Token

rt\_demo\_...

JWT

eyJhbGciOiJIUzI1NiIs...

などです。

特にJWTについては、

Raw JWT

↓

HEADER.PAYLOAD.SIGNATURE

↓

Base64URL Decode

↓

JSON

まで確認できるようにしてください。

例：

Encoded Payload

eyJzdWIiOiJ1c2VyLTAwMSJ9

Decoded Payload

{
"sub": "user-001"
}

さらに、

「この値は誰が生成したのか」

「誰が保持するのか」

「誰に送信されるのか」

「何のために使われるのか」

を表示してください。

ただし、

Passwordの平文

Private Key

実際のSecret

など、

表示すべきでない情報は表示しないでください。

# 画面構成

以下のページを作成してください。

/

Authentication Learning Lab Dashboard

/password

Password Authentication

/session

Session Authentication

/jwt

JWT Authentication

/compare/session-jwt

Session vs JWT

/oauth

OAuth 2.0

/oidc

OpenID Connect

/compare/oauth-oidc

OAuth vs OpenID Connect

/sso

Single Sign-On

/mfa

Multi-Factor Authentication

/passkey

Passkey / WebAuthn

/security

Authentication Security Lab

/architecture

Authentication Architecture

/database

Authentication Database Viewer

/glossary

Authentication Glossary

# Dashboard

トップ画面には学習ロードマップを表示してください。

LEVEL 1

Identity / Credential

LEVEL 2

Password Authentication

LEVEL 3

Password Hashing

LEVEL 4

Cookie

LEVEL 5

Session Authentication

LEVEL 6

Authorization基礎

LEVEL 7

JWT

LEVEL 8

Session vs JWT

LEVEL 9

Access Token / Refresh Token

LEVEL 10

OAuth 2.0

LEVEL 11

OpenID Connect

LEVEL 12

OAuth vs OpenID Connect

LEVEL 13

Authorization Code Flow

LEVEL 14

PKCE

LEVEL 15

SSO

LEVEL 16

MFA

LEVEL 17

Passkey / WebAuthn

LEVEL 18

Authentication Security

各LEVELからデモ画面へ遷移できるようにしてください。

# 共通UI

各認証デモ画面は可能な限り同じ構造にしてください。

左側：

User Operation

中央：

Authentication Data Flow

右側：

System State

下部：

HTTP Request / Response

Browser State

Database State

Server Logs

Explanation

Raw Authentication Data

画面を見るだけで、

「現在どのレイヤーで何が起きているのか」

理解できるようにしてください。

画面上部またはData Flow上には必ず、

Current Step

Current Location

From

To

Data

Action

を表示してください。

# Step-by-Stepモード

認証処理は一気に実行するだけではなく、

「次へ」

ボタンを押すことで1ステップずつ進められるようにしてください。

例えばSession認証では、

STEP 1

UserがEmail / Passwordを入力

STEP 2

Browserが

POST /login

を送信

STEP 3

Authentication ServerがusersテーブルからUserを検索

STEP 4

Password Hashを比較

STEP 5

認証成功

STEP 6

Session ID生成

STEP 7

Session Storeへ保存

STEP 8

Set-CookieをBrowserへ返却

STEP 9

BrowserがCookieを保持

STEP 10

Browserが

GET /mypage

を送信

STEP 11

CookieをServerへ送信

STEP 12

Session Store確認

STEP 13

Userを特定

という流れを可視化してください。

各STEPには必ず以下を表示してください。

WHAT

何をしているか

WHY

なぜ必要か

DATA

どのデータが流れているか

LOCATION

どこで処理されているか

FROM

どこから

TO

どこへ

WHO GENERATED IT

そのデータを誰が生成したか

WHO STORES IT

誰が保持しているか

# HTTP Viewer

Chrome DevToolsのNetworkタブを簡略化したようなViewerを作ってください。

REQUEST

POST /api/login

Headers

Content-Type: application/json

Body

{
"email": "[sample@example.com](mailto\:sample@example.com)",
"password": "\*\*\*\*\*\*\*\*"
}

RESPONSE

HTTP/1.1 200 OK

Headers

Set-Cookie:
session\_id=xxxx;
HttpOnly;
Secure;
SameSite=Lax

Body

{
"success": true
}

重要なHeaderについてはクリックすると説明を表示してください。

# Password Authentication

以下を実装してください。

ユーザー入力

Email
Password

↓

User検索

↓

Password Hash比較

↓

Authentication成功

Password自体はDBに保存しないでください。

Password Hashとして保存してください。

以下について説明してください。

Plain Password

Password Hash

Salt

Password Hashing Algorithm

bcrypt または Argon2等の標準的ライブラリを利用してください。

暗号アルゴリズムを自作しないでください。

# Database Viewer

最低限以下のテーブルを表示してください。

users

id
email
password\_hash
status
created\_at

sessions

id
user\_id
expires\_at
created\_at

refresh\_tokens

id
user\_id
token\_hash
expires\_at
revoked\_at

oauth\_clients

client\_id
client\_name
redirect\_uri

authorization\_codes

code
client\_id
user\_id
expires\_at

認証処理によってレコードが生成・更新された場合、

変更された箇所をハイライトしてください。

# Browser State Viewer

Browser内部の状態を表示してください。

Cookies

Local Storage

Session Storage

Cookieの場合、

Name

Value

Domain

Path

HttpOnly

Secure

SameSite

Expires

を表示してください。

特に、

HttpOnly

Secure

SameSite

の意味を説明してください。

# Session Authentication

以下を完全に可視化してください。

Browser

↓

POST /login

↓

Authentication Server

↓

User DB

↓

Password Verification

↓

Session生成

↓

Session Store

↓

Set-Cookie

↓

Browser

その後、別APIを呼び出し、

Cookie
↓
Session Lookup
↓
User特定

となるところまで再現してください。

# JWT Authentication

JWT認証画面ではJWTを分解してください。

HEADER

PAYLOAD

SIGNATURE

それぞれ別領域として表示してください。

Payload例：

{
"sub": "user-001",
"email": "[sample@example.com](mailto\:sample@example.com)",
"iat": 1234567890,
"exp": 1234570000,
"iss": "authentication-lab",
"aud": "demo-api"
}

以下のclaimを説明してください。

sub
iat
exp
iss
aud

さらにJWTについて、

「暗号化されているわけではない」

ことを明確に説明してください。

JWTを書き換えた場合、

Signature Verification Failed

になるシミュレーションも追加してください。

Raw JWT、

Encoded Header、

Decoded Header、

Encoded Payload、

Decoded Payload、

Signature

をそれぞれ確認できるようにしてください。

# Session vs JWT比較

専用ページを作成してください。

/compare/session-jwt

同一の操作に対する認証処理を左右に並べます。

例：

GET /mypage

SESSION

Cookie送信

↓

Session ID

↓

Session Store Lookup

↓

User

JWT

Bearer Token送信

↓

JWT Validation

↓

Claim取得

↓

User

ユーザーが「次へ」を押すと、

Session側とJWT側が同じ意味の処理単位で同時に進むようにしてください。

以下を表形式でも比較してください。

State Location

Browser Storage

Server Storage

Request Data

Verification

Expiration

Logout

Revocation

Scaling

Security Considerations

# Access Token / Refresh Token

ログイン後、

Access Token

Refresh Token

の2つを生成するデモを作ってください。

Access Token Expired

↓

Refresh Token送信

↓

Refresh Token検証

↓

新しいAccess Token発行

というフローをStep-by-Stepで確認できるようにしてください。

Refresh Token Revocationも再現してください。

生成された、

Access Token

Refresh Token

Expiration

Token ID

などもLearning Lab内では確認できるようにしてください。

# OAuth 2.0

OAuthについては、

Mock Authorization Server

をアプリ内部に構築してください。

登場人物：

Resource Owner

User Agent

Client

Authorization Server

Resource Server

以下のFlowを再現してください。

User

↓

Client

↓

Authorization Endpoint

↓

Login

↓

Consent

↓

Authorization Code

↓

Client

↓

Token Endpoint

↓

Access Token

↓

Resource Server

画面上で以下の値を確認できるようにしてください。

client\_id

redirect\_uri

response\_type

scope

state

authorization\_code

access\_token

OAuthについて、

「ユーザー認証のための規格ではなく、主目的はAuthorization Delegation」

であることを分かりやすく説明してください。

# PKCE

Authorization Code Flow + PKCEを実装してください。

以下を可視化してください。

code\_verifier

↓

SHA-256

↓

code\_challenge

Authorization Request

code\_challenge

Token Request

code\_verifier

Authorization Serverが検証

という流れを表示してください。

code\_verifier

code\_challenge

もLearning Lab上で実値を確認できるようにしてください。

# OpenID Connect

OAuthとの違いが理解できるようにしてください。

OAuth

Access Token

OIDC

Access Token
\+
ID Token

ID TokenのPayloadを表示してください。

例：

{
"iss": "...",
"sub": "...",
"aud": "...",
"exp": "...",
"iat": "...",
"nonce": "...",
"email": "[sample@example.com](mailto\:sample@example.com)"
}

以下の用語を説明してください。

ID Token

UserInfo Endpoint

scope=openid

nonce

OAuth画面とOIDC画面を比較できるようにしてください。

# OAuth vs OpenID Connect比較

専用ページを作成してください。

/compare/oauth-oidc

同一のAuthorization Code Flowを左右に表示してください。

OAuth側

Authorization Request

↓

Authorization Code

↓

Token Request

↓

Access Token

OIDC側

Authorization Request

scope=openid

↓

Authorization Code

↓

Token Request

↓

Access Token

-

ID Token

以下を比較してください。

Purpose

Access Token

ID Token

Identity

API Access

Scopes

UserInfo Endpoint

Claims

nonce

特に、

「OAuthのAccess Tokenをログイン証明として扱う」

という誤解が起きないような説明をしてください。

# SSO

Mock IdPを利用して、

Application A

Application B

の2アプリを用意してください。

Application A

↓

IdP Login

↓

Authentication成功

その後、

Application B

へアクセス

↓

IdP Sessionあり

↓

再ログイン不要

↓

Application B Login成功

というSSOを可視化してください。

「ApplicationのSession」

と

「IdPのSession」

を別々に表示してください。

# MFA

Password認証後に、

Second Factor

を要求する簡易MFAデモを作ってください。

Password

↓

Primary Authentication

↓

OTP

↓

Second Factor Verification

↓

Authentication Complete

TOTPについて簡潔に説明してください。

実装は教育目的のMockでも構いません。

# Passkey / WebAuthn

Passkeyについても教材画面を用意してください。

可能であれば実際のWebAuthn APIを利用してください。

難しい場合でも、

Registration

Authentication

のData Flowを再現してください。

Registration：

Browser

↓

Authenticator

↓

Public / Private Key生成

↓

Public KeyをServer保存

Authentication：

Server Challenge

↓

Authenticator

↓

Private Keyで署名

↓

Server

↓

Public Keyで検証

以下を強調してください。

Private KeyはServerへ送信されない。

PasswordをServerへ送信する方式とは異なる。

# Authentication Security Lab

以下を安全なSimulationとして実装してください。

Password Plaintext Storage

Password Hashing

Cookie Theft

Session Hijacking

Session Fixation

CSRF

XSS + Token Storage

JWT Modification

Expired Token

Refresh Token Theft

Logout

Token Revocation

「Unsafe」

と

「Secure」

の状態を切り替えられるようにしてください。

攻撃コードを外部へ利用できる形では提供せず、

このLearning Lab内部で完結するSimulationとしてください。

# Authentication / Authorization

今回は認可は基本のみ扱ってください。

user

admin

の2roleだけ実装してください。

API：

GET /api/profile

authenticated user

GET /api/admin

admin only

未ログイン：

401 Unauthorized

ログイン済みだが権限なし：

403 Forbidden

になることを可視化してください。

# Architecture画面

以下のArchitectureを表示してください。

User

↓

Browser

↓

Client Application

↓

Authentication Server / IdP

↓

User Database

Client Application

↓

Resource Server / API

さらに各要素をクリックすると、

Role

Stored Data

Responsibility

Communication

が表示されるようにしてください。

# Sequence Diagram

各Authentication方式についてSequence Diagramを作成してください。

Mermaid等を利用して構いません。

現在実行中のStepが分かるようにしてください。

可能であればStep-by-Step画面とSequence Diagramを連動してください。

Sequence Diagram上でも、

Current Location

FROM

TO

を強調表示してください。

# Server Log Viewer

認証処理のログを時系列で表示してください。

例：

10:32:01
POST /api/login

10:32:01
Find user

10:32:01
Verify password hash

10:32:01
Authentication success

10:32:01
Generate session

10:32:01
Save session

10:32:01
Generate Set-Cookie

ログを選択した場合、

Data Flow Diagramの対応箇所を強調してください。

# Raw Authentication Data Viewer

Session ID

Cookie

JWT

Access Token

Refresh Token

Authorization Code

ID Token

state

nonce

code\_verifier

code\_challenge

など、

現在の認証処理で使用されているデータをまとめて確認できるViewerを作成してください。

それぞれについて、

Value

Generated By

Stored By

Sent To

Purpose

Expiration

を表示してください。

値を選択すると、

そのデータがData Flowのどこで生成され、

どこへ移動して、

どこで利用されるかを強調表示してください。

# Learning Explanation

説明は2レベル用意してください。

Beginner

初心者向け

Engineer

エンジニア向け

例：

Beginner

「ログイン済みであることを覚えておくためにSessionを作ります。」

Engineer

「Cryptographically Secure Random Number GeneratorでSession IDを生成し、Server Side Session Storeへuser\_idとの対応を保存します。」

# 用語集

以下を最低限含めてください。

Identity

Authentication

Authorization

Credential

Password

Password Hash

Salt

Cookie

Session

JWT

Claim

Access Token

Refresh Token

OAuth 2.0

OpenID Connect

Authorization Code

PKCE

state

nonce

scope

IdP

Authorization Server

Resource Server

Client

SSO

MFA

TOTP

Passkey

WebAuthn

各項目について、

一言でいうと

用途

関連用語

具体例

を表示してください。

# Demo User

一般User：

[sample@example.com](mailto\:sample@example.com)

Admin：

[admin@example.com](mailto\:admin@example.com)

Demo用PasswordはREADMEに記載して構いません。

Database上では必ずHash化してください。

# README

READMEには、

Project Purpose

Architecture

Setup

Database Schema

Authentication Flow

Session Authentication

JWT

Session vs JWT

Access Token / Refresh Token

OAuth 2.0

OIDC

OAuth vs OIDC

PKCE

SSO

MFA

Passkey

Security

Learning Path

Directory Structure

を記載してください。

READMEを読むだけでもAuthenticationの全体像を理解できる品質にしてください。

# Architecture Design Policy

UI

Application Logic

Authentication Domain Logic

Persistence

Visualization

を明確に分離してください。

特にAuthentication Domain Logicについて、

「どこで何をしているか」

コードリーディングしやすい構造にしてください。

Authライブラリに丸投げして、

内部処理が見えなくなる実装は禁止です。

ただし、

Cryptography

Password Hash

JWT Signature

Random Generation

については、

必ず実績のある標準ライブラリを利用してください。

暗号処理を自作してはいけません。

# ADR

重要な設計判断について、

docs/adr/

へADRを作成してください。

特に、

Session Storage

JWT Algorithm

Token Expiration

Cookie Settings

OAuth Flow

PKCE

Refresh Token Strategy

について記録してください。

# Testing

最低限、

Password Verification

Session Creation

Session Validation

JWT Generate

JWT Verify

JWT Expiration

Refresh Token

OAuth Authorization Code

PKCE Validation

OIDC ID Token

Authorization

についてUnit / Integration Testを追加してください。

さらに比較画面についても、

SessionとJWTの対応Stepが一致して進行すること

OAuthとOIDCの対応Stepが一致して進行すること

をテストしてください。

# 実装順序

一度に全部作成しないでください。

PHASE 1

Project Setup

PHASE 2

Dashboard / Learning UI

PHASE 3

Password Authentication

PHASE 4

Session Authentication

PHASE 5

「今どこ？」Data Flow Visualization

PHASE 6

HTTP / DB / Browser State / Raw Data Visualization

PHASE 7

JWT

PHASE 8

Session vs JWT Comparison

PHASE 9

Access Token / Refresh Token

PHASE 10

OAuth 2.0

PHASE 11

PKCE

PHASE 12

OpenID Connect

PHASE 13

OAuth vs OIDC Comparison

PHASE 14

SSO

PHASE 15

MFA

PHASE 16

Passkey / WebAuthn

PHASE 17

Security Lab

PHASE 18

Glossary / Architecture

PHASE 19

Testing / Documentation / UX Improvement

# 最初に実施すること

コードを書く前に必ず、

1. System Architecture
2. Component Diagram
3. Directory Structure
4. Database Schema
5. Authentication Learning Path
6. Session Authentication Sequence
7. JWT Authentication Sequence
8. Session vs JWT Comparison Design
9. OAuth / OIDC Sequence
10. OAuth vs OIDC Comparison Design
11. 「今どこ？」Visualization Design
12. Raw Authentication Data Viewer Design
13. Screen Structure
14. Implementation Plan

をMarkdownで作成してください。

その後、重大な設計上の問題がなければ、

私から追加確認を取らず、

PHASE 1から順番に実装を開始してください。

# 最重要成功条件

「ログインできること」

だけでは成功ではありません。

成功条件は、

ユーザーが画面を操作しながら、

「今どこで処理されているのか」

「どこからどこへデータが流れたのか」

「Browserから何が送られたのか」

「Serverで何が起きたのか」

「Databaseで何が変わったのか」

「CookieやTokenに何が入ったのか」

「そのデータは誰が生成したのか」

「誰が保持しているのか」

「SessionとJWTは何が違うのか」

「OAuthとOIDCは何が違うのか」

「なぜその処理が必要なのか」

を説明できることです。

実装の複雑さより、

Authentication Flowの理解しやすさ

Data Flowの理解しやすさ

HTTPの理解しやすさ

Browser / Server / Databaseの責務の理解しやすさ

Session / JWTの比較の理解しやすさ

OAuth / OIDCの比較の理解しやすさ

認証データの実体の理解しやすさ

を優先してください。