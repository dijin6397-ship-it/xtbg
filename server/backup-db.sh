#!/bin/bash
# xtbg data.db 定时备份，保留 14 天
BK=/opt/backups
mkdir -p "$BK"
# 先触发一次落盘，确保内存数据刷进 data.db
curl -s --max-time 5 http://127.0.0.1:3001/api/health >/dev/null 2>&1
TS=$(date +%Y%m%d_%H%M%S)
cp -f /opt/server/data.db "$BK/data_$TS.db" 2>/dev/null
find "$BK" -name 'data_*.db' -mtime +14 -delete 2>/dev/null
ls -1t "$BK"/data_*.db 2>/dev/null | tail -n +$((14*24+1)) | xargs -r rm -f
exit 0
