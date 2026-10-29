#!/usr/bin/env bash
# Cloudflare Workers のデモ版（worklog-demo）をビルド・確認・配置する。本番（NAS）とは別物で、デモデータだけを入れる。
#   ./scripts/cf-demo.sh build     ビルドだけ（バンドルに秘密が入っていないかの検査まで）
#   ./scripts/cf-demo.sh preview   ローカルの workerd で動かす（デモ DB 127.0.0.1:5434 と .dev.vars を使う）
#                                  後ろの引数は wrangler dev に渡る（例: --test-scheduled で /__scheduled から毎日のリセットを試せる）
#   ./scripts/cf-demo.sh deploy    Cloudflare に配置する（秘密は wrangler secret put で別に入れる）
# next build は .env を読んでバンドルに埋め込む。ここには NAS 本番の .env があるので、
# Git が追う（または ignore されていない）ファイルだけを一時フォルダに写してからビルドする。
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:?build / preview / deploy のどれかを指定してください}"
SRC="$PWD"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/worklog-cf.XXXXXX")"
trap '/bin/rm -rf "$WORK"' EXIT

echo "== $WORK に写す（.env と ignore 済みのファイルは写さない）"
git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' f; do
  [ -e "$f" ] || continue # 消したが未コミットのファイル
  mkdir -p "$WORK/$(dirname "$f")"
  /bin/cp -p "$f" "$WORK/$f"
done
# APFS ではクローン（-c）なので速く、容量も食わない
/bin/cp -cR node_modules "$WORK/node_modules" 2>/dev/null || /bin/cp -R node_modules "$WORK/node_modules"
if find "$WORK" -maxdepth 1 -name '.env*' ! -name .env.example | grep -q .; then
  echo "!! .env が写っている。中止する" >&2
  exit 1
fi

cd "$WORK"
npx opennextjs-cloudflare build

echo "== バンドルに本番の値が入っていないか確かめる"
ENVFILE=.open-next/cloudflare/next-env.mjs
if grep -qE 'DATABASE_URL|APP_PASSWORD|AUTH_SECRET|POSTGRES_PASSWORD' "$ENVFILE"; then
  echo "!! $ENVFILE に環境変数が入っている。中止する" >&2
  exit 1
fi
if [ -f "$SRC/.env" ]; then
  while IFS='=' read -r k v; do
    case "$k" in APP_PASSWORD | AUTH_SECRET | POSTGRES_PASSWORD) ;; *) continue ;; esac
    [ ${#v} -ge 8 ] || continue
    if grep -rqF -- "$v" .open-next; then
      echo "!! .env の $k の値がバンドルに入っている。中止する" >&2
      exit 1
    fi
  done < "$SRC/.env"
fi
echo "   入っていない"

case "$MODE" in
  build) ;;
  preview)
    [ -f "$SRC/.dev.vars" ] && /bin/cp "$SRC/.dev.vars" .dev.vars
    npx opennextjs-cloudflare preview --port "${PORT:-8787}" "${@:2}"
    ;;
  deploy) npx opennextjs-cloudflare deploy ;;
  *) echo "不明な指定: $MODE" >&2; exit 1 ;;
esac
