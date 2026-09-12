# 协同平台

协同平台是一套面向团队的任务协同与督办管理系统，支持任务创建、分解、反馈、审核、督办等全生命周期管理。前端使用 Vue 3 + Vite 构建，后端基于 Express，数据存储采用 SQLite（sql.js），开箱即用，无需额外数据库服务。

## 主要特性

- **任务全流程管理**：创建任务 -> 分解子任务 -> 执行反馈 -> 审核验收 -> 归档，状态自动流转。
- **多角色权限**：管理员、领导、主管、员工等角色拥有不同视图和操作权限。
- **移动端 + 管理端**：提供移动端快速处理与管理端精细管理两种界面。
- **督办中心**：支持催办、警告、升级等督办操作，记录完整的督办日志。
- **仪表盘统计**：实时展示待办、进行中、逾期、审核等任务统计信息。
- **本地化存储**：使用 SQLite 文件存储数据，便于开发和演示环境快速启动。

## 技术架构

- **前端**：Vue 3 + Vue Router + Vite，支持响应式布局。
- **后端**：Express RESTful API，JWT 认证，bcrypt 密码加密。
- **数据库**：sql.js（SQLite in-memory + 文件持久化）。

## 目录结构（节选）

```text
.
├─ index.html                # Vite 入口
├─ package.json              # 前端依赖与脚本
├─ vite.config.js            # Vite 配置（代理、端口等）
├─ src/                      # 前端源码
│  ├─ api/index.js           # 封装后端接口
│  ├─ router/index.js        # 路由及权限控制
│  ├─ store/                 # 状态管理（auth、tasks）
│  ├─ components/            # 公共组件
│  └─ views/                 # 页面（mobile / admin / 公共）
└─ server/                   # 后端服务
   ├─ index.js               # Express 启动入口
   ├─ db.js                  # 数据库初始化与种子数据
   ├─ middleware/auth.js      # JWT 鉴权中间件
   └─ routes/                # 路由模块（auth、tasks、users、supervision）
```

## 页面与路由

- `/`：落地页/入口页。
- `/admin/login`：登录页（公开路由）。
- `/m/*`：移动端功能区，包含工作台、任务列表、任务发布、详情、分解、反馈、申请完成、督办中心等。
- `/admin/*`：管理端功能区，包含工作台、任务管理、新建任务、任务详情、分解、反馈、审核、展示、督办、账号管理等。
- 路由守卫在 `src/router/index.js` 中实现，未登录时跳转到 `/admin/login`，管理员专属页面需要 `admin` 角色。

## 后端 API 概览

- **认证**：`/api/auth/login`、`/api/auth/me`、`/api/auth/password`。
- **任务**：`/api/tasks` 列表/创建，`/api/tasks/:id` 查看/更新，`/api/tasks/:id/decompose` 分解，`/api/tasks/:id/feedback` 提交反馈，`/api/tasks/:id/review` 审核，`/api/tasks/:id/complete` 提交完成，`/api/tasks/:id/urge` 催办，`/api/stats/overview` 统计。
- **用户管理**：`/api/users` 获取用户列表（管理员可创建/更新/删除）。
- **督办日志**：`/api/supervision` 查看日志，`/api/supervision/stats` 统计。
- 更多细节请参考 `server/routes/` 目录下的实现。

## 环境变量

- `JWT_SECRET`：用于签发 JWT（建议在 `server/.env` 中配置）。
- `PORT`：后端端口，默认 `3001`。

## 本地开发

```bash
# 后端
cd server
npm install
npm run dev   # 默认 http://localhost:3001

# 前端
npm install
npm run dev   # 默认 http://localhost:3000，自动代理 /api -> 后端
```

## 生产构建

```bash
npm run build   # 输出到 dist/
npm run preview # 本地预览构建产物
```

如需前后端分离部署，可将 `dist/` 部署到静态服务器，并将后端 API 配置到相同域名或通过反向代理暴露 `/api`。

## 种子数据

- 首次启动时会自动初始化数据库并写入示例用户和任务（见 `server/db.js`）。
- 默认管理员账号 `admin`，密码 `123456`，其他用户密码相同，仅用于演示。
- 数据库文件保存在 `server/data.db`，删除后重新运行会重新生成。

## 常见问题

- 若启动时提示端口占用，可在 `vite.config.js`（前端）或环境变量 `PORT`（后端）中调整。
- 若需要清空数据，删除 `server/data.db` 后重启后端即可。
- 前端请求 401 时，请确认已在 `/admin/login` 登录并保持 localStorage 中存在 token。

## 许可证

本项目仅用于内部演示与学习，未经授权不得用于商业用途。
