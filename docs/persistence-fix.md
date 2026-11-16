# data.db 持久化缺陷修复说明

## 背景

后端使用 sql.js（纯内存 SQLite），`saveDB()` 负责把整库导出后覆盖写入 `data.db`。

修复前，`saveDB()` 仅在服务启动、SIGINT/SIGTERM 退出、`/api/health` 被调用时执行。
而前端从不调用 `/api/health`，所有业务写入（任务、用户、字典、WBS 等）只停留在内存，
进程重启或断电即丢失，且磁盘上的旧库会掩盖问题——出现"录入数据凭空消失"的现象。

## 修复内容

### 1. `server/db.js`：`saveDB()` 改为原子写 + fsync

- 先写入 `data.db.tmp`
- 循环 `fs.writeSync` 写完全部字节
- `fs.fsyncSync` 刷盘
- `fs.renameSync` 原子覆盖 `data.db`
- 额外对所在目录做一次 fsync（best-effort）

避免断电时 `data.db` 被截断成半截文件。

### 2. `server/index.js`：新增写请求落盘中间件

`persistMiddleware` 挂在所有业务路由之前，对任何非 GET/HEAD/OPTIONS 请求，
在响应 `finish`/`close` 时调用一次 `saveDB()`（5xx 响应跳过）。
保证"接口返回成功 = 数据已在磁盘"。

### 3. `server/backup-db.sh`：小时级备份

备份文件写入 `/opt/backups/data_YYYYmmdd_HHMMSS.db`，保留 14 天。

安装：

```bash
cp backup-db.sh /opt/server/ && chmod 755 /opt/server/backup-db.sh
printf 'SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n0 * * * * root /bin/bash /opt/server/backup-db.sh\n' > /etc/cron.d/xtbg-backup
chmod 644 /etc/cron.d/xtbg-backup
```

## 验证方法

```bash
# 1. 触发一次业务写入
curl -s -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"x","password":"y"}'
# 2. 立即检查 data.db 时间戳应已刷新
stat -c '%y %s' /opt/server/data.db
# 3. 重启服务后数据仍在
systemctl restart collab-platform
systemctl status collab-platform --no-pager
```

## 部署注意

- 修复只涉及后端 3 个文件，前端 `dist` 无需重新构建。
- 部署脚本严禁再把 `/opt/data` 等目录下的历史库覆盖到 `/opt/server/data.db`；
  覆盖前必须确认源文件确实比线上库更新（比较 mtime 与业务数据）。
- `server/data.db` 已在 `.gitignore` 中，数据库文件不入库。
