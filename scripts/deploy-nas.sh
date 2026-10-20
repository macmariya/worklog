#!/usr/bin/env bash
# NAS（UGOS Pro の Docker）へ配置して docker compose で起動し直す。
#   ./scripts/deploy-nas.sh            ソースを tar で送り、NAS 上でビルドして起動する
#   ./scripts/deploy-nas.sh --image    Mac で linux/amd64 のイメージを作り、docker save | load で持ち込む
# 接続先は .env.deploy（gitignore）に書く:
#   DEPLOY_HOST=<ssh の接続名>   DEPLOY_DIR=/volume1/docker/worklog   DEPLOY_URL=http://<nas-ip>:3100
# 初回だけ NAS に .env を作る。ログインのパスワードは ~/.config/worklog/web-password に控える（チャットや画面に出さない）。
# マイグレーションとシードは自動では流さない（03 §7）。初回は最後に表示するコマンドを手で実行する。
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.deploy ] && . ./.env.deploy
: "${DEPLOY_HOST:?.env.deploy に DEPLOY_HOST を書いてください}"
: "${DEPLOY_URL:?.env.deploy に DEPLOY_URL を書いてください}"
DIR="${DEPLOY_DIR:-/volume1/docker/worklog}"
MODE="${1:-}"
CONF="$HOME/.config/worklog"

ssh "$DEPLOY_HOST" "mkdir -p '$DIR/backups'"

if [ "$MODE" = "--image" ]; then
  echo "== Mac で linux/amd64 のイメージを作る"
  docker build --platform linux/amd64 -t worklog-app:local .
  echo "== docker save | ssh docker load"
  docker save worklog-app:local | gzip -1 | ssh "$DEPLOY_HOST" "gunzip | docker load"
  COPYFILE_DISABLE=1 tar -czf - docker-compose.yml | ssh "$DEPLOY_HOST" "cd '$DIR' && tar -xzf -"
  UP="docker compose up -d --no-build"
else
  # UGOS の rsync は SSH 経由の書き込みを受け付けない（invalid path）ので tar で流す。
  # src/ などは消してから展開する（消したファイルを残さない）。.env と backups/ には触れない
  FILES=(package.json package-lock.json .npmrc .dockerignore Dockerfile docker docker-compose.yml
         next.config.ts tsconfig.json eslint.config.mjs drizzle.config.ts drizzle scripts seed src public)
  echo "== ソースを送る"
  COPYFILE_DISABLE=1 tar -czf - "${FILES[@]}" \
    | ssh "$DEPLOY_HOST" "cd '$DIR' && rm -rf src drizzle scripts seed docker public && tar -xzf -"
  UP="docker compose up -d --build"
fi

if ! ssh "$DEPLOY_HOST" "test -f '$DIR/.env'"; then
  echo "== 初回: NAS に .env を作る"
  umask 077
  mkdir -p "$CONF"
  PG=$(openssl rand -hex 16)
  PASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
  ssh "$DEPLOY_HOST" "umask 077; cat > '$DIR/.env'" <<ENV
POSTGRES_USER=worklog
POSTGRES_PASSWORD=$PG
POSTGRES_DB=worklog
DATABASE_URL=postgres://worklog:$PG@db:5432/worklog
APP_PASSWORD=$PASS
AUTH_SECRET=$(openssl rand -hex 32)
TZ=UTC
APP_TZ=Asia/Tokyo
APP_PORT=3100
ENV
  # UGOS の共有フォルダは ACL で誰でも読める権限になるので、所有者だけに絞る
  ssh "$DEPLOY_HOST" "chmod 600 '$DIR/.env'"
  printf 'URL: %s\nパスワード: %s\n' "$DEPLOY_URL" "$PASS" > "$CONF/web-password"
  echo "   ログインのパスワード → $CONF/web-password（パスワード管理に移したら消してよい）"
fi

echo "== 起動（$UP）"
time ssh "$DEPLOY_HOST" "cd '$DIR' && $UP 2>&1 | tail -5"

echo "== 動作確認"
for _ in $(seq 1 20); do
  curl -fsS --max-time 3 "$DEPLOY_URL/api/health" >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS --max-time 5 "$DEPLOY_URL/api/health"; echo
printf '画面（未ログイン）: %s（307 なら正しい）\n' "$(curl -s -o /dev/null -w '%{http_code}' "$DEPLOY_URL/")"
cat <<MSG
初回・マイグレーションを足したときは手で流す:
  ssh $DEPLOY_HOST "cd '$DIR' && docker compose exec -T app npm run db:migrate && docker compose exec -T app npm run db:seed"
MSG
