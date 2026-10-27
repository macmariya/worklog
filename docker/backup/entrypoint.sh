#!/bin/sh
# backup コンテナの入口。crond を前面で動かし、毎日 BACKUP_CRON（既定 3:00。TZ=Asia/Tokyo）に backup.sh を流す。
# ジョブの出力は PID 1 の標準出力へ送るので、docker compose logs backup で見られる。
set -eu
echo "${BACKUP_CRON:-0 3 * * *} /scripts/backup.sh > /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "$(date '+%F %T %Z') crond 起動: $(cat /etc/crontabs/root)"
exec crond -f -l 8
