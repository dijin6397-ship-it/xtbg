# 账号管理页面改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Goal:** 修复账号管理页面编辑弹窗跳动问题，并新增用户硬删除与模块权限配置功能。
> **Architecture:** 前端 A_UserManagement.vue 增删改查交互 + Dialog 扩展；后端 users.js 新增硬删除接口，复用已有 user_modules / setUserModules 能力。
> **Tech Stack:** Vue 3 (Composition API), Express, sql.js

## Global Constraints
- 使用中文界面与中文提示。
- 仅管理员可操作删除与模块权限。
- 硬删除须级联清理与用户相关的关联数据，避免数据库残留。
- 弹窗打开时锁定 body 滚动，防止跳动。

---

### Task 1: 修复编辑/新增弹窗跳动并优化交互
**Covers:** 用户反馈 Bug 修复
**Files:**
- Modify: `src/views/admin/A_UserManagement.vue`
**Interfaces:**
- Consumes: 现有 ref/reactive/store
- Produces: 稳定的 dialog 打开/关闭体验
- [ ] Step 1: 在 Dialog 开关逻辑中增加 body 滚动锁定 `document.body.classList.add('modal-open')` / `remove('modal-open')`
- [ ] Step 2: 确保 `.dialog-overlay` 使用 `position: fixed; inset: 0` 并居中，新增全局/局部 CSS 规则 `.modal-open { overflow: hidden }`
- [ ] Step 3: 验证点击 overlay 空白处可关闭、点击按钮不会误触发关闭或抖动
- [ ] Step 4: 提交改动

```vue
<!-- 关键改动示意：openEditDialog / openCreateDialog / showDialog watch -->
watch(showDialog, (v) => {
  document.body.classList.toggle('modal-open', v)
})
```

```css
/* 关键改动示意 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
body.modal-open {
  overflow: hidden;
}
```

---

### Task 2: 后端新增硬删除接口
**Covers:** 需求：真正的硬删除
**Files:**
- Modify: `server/routes/users.js`
**Interfaces:**
- Consumes: `getDB`, `authMiddleware`, `requireRole`, `req.user`
- Produces: `DELETE /api/users/:id/hard` 返回 `{ message }`
- [ ] Step 1: 在 router 上新增 `router.delete('/:id/hard', authMiddleware, requireRole('admin'), handler)`
- [ ] Step 2: 解析 userId，阻止删除自己（`id === req.user.id`）
- [ ] Step 3: 按依赖顺序级联删除：`task_assignees`、`subtasks`、`task_outputs`、`feedbacks`、`supervision_logs`（operator/target）、`notifications`、`user_modules`，最后删除 `users` 行
- [ ] Step 4: commit

```js
router.delete('/:id/hard', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return res.status(400).json({ error: '不能删除自己' })
  const db = getDB()
  db.run('DELETE FROM task_assignees WHERE user_id = ?', [id])
  db.run('DELETE FROM subtasks WHERE assignee_id = ?', [id])
  db.run('DELETE FROM task_outputs WHERE user_id = ?', [id])
  db.run('DELETE FROM feedbacks WHERE user_id = ?', [id])
  db.run('DELETE FROM supervision_logs WHERE operator_id = ? OR target_id = ?', [id, id])
  db.run('DELETE FROM notifications WHERE user_id = ?', [id])
  db.run('DELETE FROM user_modules WHERE user_id = ?', [id])
  db.run('DELETE FROM users WHERE id = ?', [id])
  res.json({ message: '已永久删除' })
})
```

---

### Task 3: 前端 API 扩展与模块权限数据加载
**Covers:** 需求：调用硬删除接口 + 加载模块列表
**Files:**
- Modify: `src/api/index.js`
- Modify: `src/views/admin/A_UserManagement.vue`
**Interfaces:**
- Consumes: `request`, `moduleAPI`, `userAPI`
- Produces: `userAPI.hardDelete`，页面级 `allModules` 状态
- [ ] Step 1: 在 `userAPI` 对象中新增 `hardDelete: (id) => request('/users/${id}/hard', { method: 'DELETE' })`
- [ ] Step 2: 在 A_UserManagement.vue 增加 `allModules = ref([])`，`onMounted` 调用 `moduleAPI.list()` 赋值
- [ ] Step 3: 打开编辑弹窗时，如果已有 `user.modules`，回填 `form.moduleIds = user.modules.map(m => m.id)`
- [ ] Step 4: 提交改动

```js
export const moduleAPI = {
  list: () => request('/modules'),
  myModules: () => request('/modules/my'),
  setUserModules: (userId, moduleIds) => request(`/modules/${userId}`, { method: 'PUT', body: JSON.stringify({ moduleIds }) })
}
```

```js
// 在 userAPI 中追加：
hardDelete: (id) => request(`/users/${id}/hard`, { method: 'DELETE' })
```

---

### Task 4:Dialog 增加模块权限复选框 + 表格增加删除按钮
**Covers:** 需求：模块权限配置 + 硬删除入口
**Files:**
- Modify: `src/views/admin/A_UserManagement.vue`
**Interfaces:**
- Consumes: `allModules`, `userAPI.hardDelete`, `moduleAPI.setUserModules`
- Produces: 更新后的用户表单与操作列
- [ ] Step 1: form 增加 `moduleIds: []`，template 中新增模块多选区域（`v-for` + checkbox）
- [ ] Step 2: 保存成功后，`await moduleAPI.setUserModules(userId, form.moduleIds)`
- [ ] Step 3: 操作列新增"删除"按钮，调用 `confirmHardDelete(user)`，确认后 `await userAPI.hardDelete(user.id)`，失败 alert，成功刷新列表
- [ ] Step 4: 提交改动

```vue
<!-- 模板新增（位于职务输入框后） -->
<div class="form-group">
  <label class="form-label">模块权限</label>
  <div class="module-check-grid">
    <label v-for="mod in allModules" :key="mod.id" class="module-check">
      <input type="checkbox" :value="mod.id" v-model="form.moduleIds" />
      <span>{{ mod.name }}</span>
    </label>
  </div>
</div>
```

```css
.module-check-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.module-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}
```

```js
// confirmHardDelete 逻辑示意
async function confirmHardDelete(user) {
  if (!confirm(`确定要永久删除用户「${user.name}」吗？此操作不可恢复。`)) return
  try {
    await userAPI.hardDelete(user.id)
    await loadUsers()
  } catch (e) {
    alert(e.message)
  }
}
```

---

### Task 5: 联调验证
**Covers:** 整体验收
**Interfaces:**
- Consumes: Task 1~4 改动
- Produces: 可用、无跳动、删除与模块配置生效
- [ ] Step 1: npm run build 编译通过
- [ ] Step 2: 启动后端 `cd server && node index.js`，通过浏览器访问 `/admin/users`
- [ ] Step 3: 验证：编辑弹窗正常居中、不跳动；新增用户可勾模块并保存；编辑用户能更新模块权限；删除按钮二次确认后列表刷新
- [ ] Step 4: 若发现 UI 异常，立即修复并重新验证；通过后 commit

---

_Plan written by Compose Agent._
