#!/bin/sh
# 日次バックアップ（04 §5）: pg_dump -Fc を /backups/worklog_YYYYMMDD.dump に書き、BACKUP_KEEP_DAYS（既定 30）日より古いものを消す。
# 書いた直後に pg_restore --list で読めることを確かめ、壊れたダンプ（0 バイトなど）を正しい名前で残さない。
# ダンプは個人のデータを含み、NAS の共有フォルダは ACL で誰でも読める権限になるので、所有者だけが読める 600 にする。
set -eu
umask 077
export PGHOST="${PGHOST:-db}" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB"
DIR=/backups
out="$DIR/worklog_$(date +%Y%m%d).dump"
tmp="$out.tmp"
trap 'rm -f "$tmp"' EXIT

pg_dump -Fc -f "$tmp"
pg_restore --list "$tmp" > /dev/null
chmod 600 "$tmp"
# バインドマウント先の持ち主に合わせる（NAS の一般ユーザーで取り出せるように）
chown "$(stat -c %u:%g "$DIR")" "$tmp" 2> /dev/null || true
mv -f "$tmp" "$out"

find "$DIR" -maxdepth 1 -name 'worklog_*.dump' -mtime +"${BACKUP_KEEP_DAYS:-30}" -print -exec rm -f {} \;
echo "$(date '+%F %T %Z') バックアップ完了: $out（$(wc -c < "$out") バイト・$(ls "$DIR"/worklog_*.dump | wc -l) 世代）"
