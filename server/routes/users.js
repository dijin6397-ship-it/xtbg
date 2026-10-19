import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireBackendModule } from '../module-access.js'
import { parsePermissions, serializePermissions, PERMISSIONS, PERMISSION_LABELS } from '../permissions.js'

const router = Router()

// Helper: convert DB row to safe user (no password), 并把 permissions 解析为数组
function safeUser(row) {
  if (!row) return null
  const { password, ...safe } = row
  safe.permissions = parsePermissions(safe.permissions, safe.role)
  return safe
}

// Helper: get all users as array
function getAllUsers(db, filters = {}) {
  let sql = 'SELECT id, username, name, department, role, title, active, created_at, permissions FROM users WHERE 1=1'
  const params = []

  if (filters.role) {
    sql += ' AND role = ?'
    params.push(filters.role)
  }
  if (filters.active !== undefined) {
    sql += ' AND active = ?'
    params.push(filters.active)
  }
  if (filters.search) {
    sql += ' AND (name LIKE ? OR username LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  sql += ' ORDER BY id ASC'
  const stmt = db.prepare(sql)
  stmt.bind(params)

  const results = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    row.permissions = parsePermissions(row.permissions, row.role)
    results.push(row)
  }
  stmt.free()
  return results
}

// GET /api/users - List all users
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const users = getAllUsers(db, req.query)
  res.json({ users })
})

// GET /api/users/permissions - 可配置的细粒度权限清单（管理员）
router.get('/permissions', authMiddleware, requireBackendModule, (req, res) => {
  res.json({
    permissions: Object.values(PERMISSIONS).map(key => ({ key, label: PERMISSION_LABELS[key] || key }))
  })
})

// GET /api/users/full - List all users with their module assignments (admin only)
// 注意：必须定义在 /:id 之前，否则会被 /:id 抢先匹配。
router.get('/full', authMiddleware, requireBackendModule, (req, res) => {
  const db = getDB()
  const users = getAllUsers(db, req.query)
  // Attach modules to each user
  const modRows = db.exec('SELECT id, module_key, name FROM modules ORDER BY sort_order')
  const allMods = modRows.length > 0 ? modRows[0].values.map(r => ({ id: r[0], moduleKey: r[1], name: r[2] })) : []

  for (const user of users) {
    const umRows = db.exec('SELECT module_id FROM user_modules WHERE user_id = ' + user.id)
    const assignedIds = umRows.length > 0 ? umRows[0].values.map(r => r[0]) : []
    user.modules = allMods.map(m => ({ ...m, assigned: assignedIds.includes(m.id) }))
  }
  res.json({ users, modules: allMods })
})

// GET /api/users/:id
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB()
  const stmt = db.prepare('SELECT id, username, name, department, role, title, active, created_at, permissions FROM users WHERE id = ?')
  stmt.bind([Number(req.params.id)])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  if (!row) return res.status(404).json({ error: '用户不存在' })
  row.permissions = parsePermissions(row.permissions, row.role)
  res.json({ user: row })
})

// POST /api/users - Create user（后台管理模块权限）
router.post('/', authMiddleware, requireBackendModule, (req, res) => {
  const { username, password, name, role, title, department } = req.body
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: '缺少必填字段' })
  }

  // 防提权：非管理员不能创建 admin 角色账号
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足：只有管理员可以创建管理员账号' })
  }

  const db = getDB()

  // Check duplicate username
  const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?')
  checkStmt.bind([username])
  if (checkStmt.step()) {
    checkStmt.free()
    return res.status(400).json({ error: '用户名已存在' })
  }
  checkStmt.free()

  const hash = bcrypt.hashSync(password, 10)
  db.run(
    'INSERT INTO users (username, password, name, department, role, title) VALUES (?, ?, ?, ?, ?, ?)',
    [username, hash, name, department || '技术质量部', role, title || '']
  )

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  const stmt = db.prepare('SELECT id, username, name, department, role, title, active FROM users WHERE id = ?')
  stmt.bind([id])
  const user = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json({ user })
})

// PUT /api/users/:id - Update user（后台管理模块权限）
router.put('/:id', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const { name, role, title, department, active, password, permissions } = req.body
  const db = getDB()

  const checkStmt = db.prepare('SELECT id, role FROM users WHERE id = ?')
  checkStmt.bind([id])
  const target = checkStmt.step() ? checkStmt.getAsObject() : null
  if (!target) {
    checkStmt.free()
    return res.status(404).json({ error: '用户不存在' })
  }
  checkStmt.free()

  // 防提权：非管理员不能把任何账号改成 admin，也不能修改 admin 账号
  if (req.user.role !== 'admin') {
    if (role === 'admin') {
      return res.status(403).json({ error: '权限不足：只有管理员可以设置管理员角色' })
    }
    if (target.role === 'admin') {
      return res.status(403).json({ error: '权限不足：不能修改管理员账号' })
    }
  }

  const updates = []
  const params = []

  if (name !== undefined) { updates.push('name = ?'); params.push(name) }
  if (role !== undefined) { updates.push('role = ?'); params.push(role) }
  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (department !== undefined) { updates.push('department = ?'); params.push(department) }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0) }
  if (permissions !== undefined) { updates.push('permissions = ?'); params.push(serializePermissions(permissions)) }
  if (password) {
    updates.push('password = ?')
    params.push(bcrypt.hashSync(password, 10))
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' })
  }

  params.push(id)
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

  const stmt = db.prepare('SELECT id, username, name, department, role, title, active, permissions FROM users WHERE id = ?')
  stmt.bind([id])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  if (row) row.permissions = parsePermissions(row.permissions, row.role)

  res.json({ user: row })
})

// DELETE /api/users/:id - Soft delete（后台管理模块权限）
router.delete('/:id', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  if (id === req.user.id) {
    return res.status(400).json({ error: '不能禁用自己' })
  }

  // 防提权：非管理员不能禁用管理员账号
  if (req.user.role !== 'admin') {
    const t = db.prepare('SELECT role FROM users WHERE id = ?')
    t.bind([id])
    const row = t.step() ? t.getAsObject() : null
    t.free()
    if (row && row.role === 'admin') {
      return res.status(403).json({ error: '权限不足：不能禁用管理员账号' })
    }
  }

  db.run('UPDATE users SET active = 0 WHERE id = ?', [id])
  res.json({ message: '已禁用' })
})

// DELETE /api/users/:id/hard - Hard delete（仅管理员）
router.delete('/:id/hard', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  if (id === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' })
  }

  // 永久删除不可恢复，仅管理员可执行
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足：仅管理员可永久删除账号' })
  }

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

export default router
