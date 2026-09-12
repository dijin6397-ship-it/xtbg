import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDB } from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

// Helper: convert DB row to safe user (no password)
function safeUser(row) {
  if (!row) return null
  const { password, ...safe } = row
  return safe
}

// Helper: get all users as array
function getAllUsers(db, filters = {}) {
  let sql = 'SELECT id, username, name, department, role, title, active, created_at FROM users WHERE 1=1'
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
    results.push(stmt.getAsObject())
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

// GET /api/users/:id
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB()
  const stmt = db.prepare('SELECT id, username, name, department, role, title, active, created_at FROM users WHERE id = ?')
  stmt.bind([Number(req.params.id)])
  const user = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  if (!user) return res.status(404).json({ error: '用户不存在' })
  res.json({ user })
})

// POST /api/users - Create user (admin only)
router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, password, name, role, title, department } = req.body
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: '缺少必填字段' })
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

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id)
  const { name, role, title, department, active, password } = req.body
  const db = getDB()

  const checkStmt = db.prepare('SELECT id FROM users WHERE id = ?')
  checkStmt.bind([id])
  if (!checkStmt.step()) {
    checkStmt.free()
    return res.status(404).json({ error: '用户不存在' })
  }
  checkStmt.free()

  const updates = []
  const params = []

  if (name !== undefined) { updates.push('name = ?'); params.push(name) }
  if (role !== undefined) { updates.push('role = ?'); params.push(role) }
  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (department !== undefined) { updates.push('department = ?'); params.push(department) }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0) }
  if (password) {
    updates.push('password = ?')
    params.push(bcrypt.hashSync(password, 10))
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' })
  }

  params.push(id)
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

  const stmt = db.prepare('SELECT id, username, name, department, role, title, active FROM users WHERE id = ?')
  stmt.bind([id])
  const user = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.json({ user })
})

// GET /api/users/full - List all users with their module assignments (admin only)
router.get('/full', authMiddleware, requireRole('admin'), (req, res) => {
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

// DELETE /api/users/:id - Soft delete (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  if (id === req.user.id) {
    return res.status(400).json({ error: '不能禁用自己' })
  }

  db.run('UPDATE users SET active = 0 WHERE id = ?', [id])
  res.json({ message: '已禁用' })
})

// DELETE /api/users/:id/hard - Hard delete (admin only)
router.delete('/:id/hard', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  if (id === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' })
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
