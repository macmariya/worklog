# worklog

一人用の作業時間記録アプリ。事業／私用と案件・作業種別で時間を記録し、家事按分の根拠と案件別の工数を貯める。
LAN と Tailscale の内側（自宅 NAS の Docker）で動かす前提で、WAN には公開しない。

> Phase 1（MVP）の段階。月次レポート・CSV・バックアップは Phase 2、英語の README とスクリーンショットは Phase 3 で整える。

## 機能（Phase 1）

- タイマーの開始・停止（稼働中は常に 1 件。別の案件で開始すると前の記録を自動で止める）
- 手入力と修正・削除（日付をまたぐ区間は JST の 0:00 で自動分割。時間の重なりは警告して、承知すれば保存）
- 日次一覧（事業・私用・未記録の合計）
- 案件・作業種別のマスタ（追加・編集・アーカイブ）
- 共通パスワード 1 つのログイン（署名付き Cookie、90 日）
- JSON API: `GET /api/timer`・`POST /api/timer/start`・`POST /api/timer/stop`・`GET /api/day/YYYY-MM-DD`

## 設計の要点

- 「稼働中は 1 件だけ」を部分ユニークインデックス `ON time_entries ((true)) WHERE ended_at IS NULL` で DB が保証する
- 「1 件の記録は JST の 1 日に収まる」を CHECK 制約で保証し、またぐ入力はアプリが 0:00 で分割してから保存する
- 時刻は `timestamptz`（UTC）で保存し、JST の日付は IMMUTABLE 関数 `jst_date()` を使った生成列 `entry_date` に持つ

## 構成

Next.js 16（App Router）／ TypeScript ／ Drizzle ORM ／ PostgreSQL 18 ／ Docker Compose（`app`・`db` の 2 コンテナ）。Node.js 24。

## 起動

```bash
cp .env.example .env   # 値を入れる（AUTH_SECRET は openssl rand -hex 32）
docker compose up -d --build
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed   # seed/seed.demo.json（汎用名）を入れる
```

`http://localhost:3100` を開き、`.env` の `APP_PASSWORD` でログインする。

## 開発

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # DB だけ 127.0.0.1:5433 に出す
npm ci
npm test            # Vitest（JST の日付分割・認証）
npm run typecheck
npm run lint
```

マイグレーションは `npm run db:generate` で `drizzle/` に SQL を作り、中身を読んでからコミットする。本番では起動時に自動適用しない。

## NAS への配置

`.env.deploy`（コミットしない）に `DEPLOY_HOST`（ssh の接続名）・`DEPLOY_DIR`・`DEPLOY_URL` を書き、`./scripts/deploy-nas.sh` を実行する。
既定はソースを送って NAS 上でビルドする。`--image` を付けると Mac で `linux/amd64` のイメージを作って `docker save | docker load` で持ち込む。
