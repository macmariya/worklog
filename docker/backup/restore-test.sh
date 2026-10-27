#!/bin/sh
# 復元テスト（04 §5）: ダンプを別 DB（worklog_restore_test）に pg_restore し、本番の DB と表ごとに件数と中身のハッシュを突合する。
#   docker compose exec backup /scripts/restore-test.sh                 最新のダンプ
#   docker compose exec backup /scripts/restore-test.sh /backups/x.dump 指定したダンプ
# 一致しなければ終了コード 1。ダンプの後に記録を足した・止めた場合は time_entries が一致しないので、その差かどうかを見て判断する。
set -eu
export PGHOST="${PGHOST:-db}" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB"
f="${1:-$(ls -1 /backups/worklog_*.dump | tail -n 1)}"
T=worklog_restore_test
trap 'dropdb --if-exists "$T"' EXIT

dropdb --if-exists "$T"
createdb "$T"
pg_restore --no-owner --exit-on-error -d "$T" "$f"
echo "ダンプ: $f"

ng=0
for t in activities projects time_entries; do
  q="select count(*) || ' ' || coalesce(md5(string_agg(x::text, '|' order by id)), '-') from $t x"
  live=$(psql -Atc "$q")
  back=$(psql -d "$T" -Atc "$q")
  if [ "$live" = "$back" ]; then mark=一致; else mark=不一致; ng=1; fi
  printf '%-13s 本番 %-40s 復元 %-40s %s\n' "$t" "$live" "$back" "$mark"
done
# 生成列（entry_date）と制約が復元後も働くか
psql -d "$T" -Atc "select 'jst_date(2026-10-20T15:00Z) = ' || jst_date('2026-10-20T15:00:00Z')"
exit $ng
