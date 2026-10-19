import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireBackendModule } from '../module-access.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT id, module_key, name, path, description, sort_order FROM modules ORDER BY sort_order')
  const modules = rows.length > 0 ? rows[0].values.map(r => ({ id: r[0], moduleKey: r[1], name: r[2], path: r[3], description: r[4], sortOrder: r[5] })) : []
  res.json({ modules })
})

router.get('/my', authMiddleware, (req, res) => {
  const db = getDB()
  // Admin gets all modules
  if (req.user.role === 'admin') {
    const rows = db.exec('SELECT id, module_key, name, path, description, sort_order FROM modules ORDER BY sort_order')
    const modules = rows.length > 0 ? rows[0].values.map(r => ({ id: r[0], moduleKey: r[1], name: r[2], path: r[3], description: r[4], sortOrder: r[5] })) : []
    return res.json({ modules })
  }
  const rows = db.exec('SELECT m.id, m.module_key, m.name, m.path, m.description, m.sort_order FROM modules m JOIN user_modules um ON m.id = um.module_id WHERE um.user_id = ' + req.user.id + ' ORDER BY m.sort_order')
  const modules = rows.length > 0 ? rows[0].values.map(r => ({ id: r[0], moduleKey: r[1], name: r[2], path: r[3], description: r[4], sortOrder: r[5] })) : []
  res.json({ modules })
})

// PUT /api/modules/:userId - 设置用户模块权限
// 需要「后台管理」模块权限或管理员（账号管理页保存模块权限时调用）
router.put('/:userId', authMiddleware, requireBackendModule, (req, res) => {
  const db = getDB()
  const userId = Number(req.params.userId)
  const { moduleIds } = req.body
  if (!Array.isArray(moduleIds)) return res.status(400).json({ error: 'moduleIds must be array' })

  // 目标用户必须存在
  const uStmt = db.prepare('SELECT id, role FROM users WHERE id = ?')
  uStmt.bind([userId])
  const target = uStmt.step() ? uStmt.getAsObject() : null
  uStmt.free()
  if (!target) return res.status(404).json({ error: '用户不存在' })

  // 防提权：非管理员不能修改管理员账号的模块权限
  if (req.user.role !== 'admin' && target.role === 'admin') {
    return res.status(403).json({ error: '权限不足：不能修改管理员账号的模块权限' })
  }

  // 防提权：非管理员不能把「后台管理」模块授予他人（避免自我扩散权限）
  if (req.user.role !== 'admin') {
    const beStmt = db.prepare("SELECT id FROM modules WHERE module_key = 'admin_backend'")
    let beId = null
    if (beStmt.step()) beId = beStmt.getAsObject().id
    beStmt.free()
    if (beId && moduleIds.map(Number).includes(Number(beId))) {
      // 允许保留自己已有的该模块，但不允许新授予他人
      const ownStmt = db.prepare('SELECT COUNT(*) AS c FROM user_modules WHERE user_id = ? AND module_id = ?')
      ownStmt.bind([userId, beId])
      const ownRow = ownStmt.step() ? ownStmt.getAsObject() : null
      ownStmt.free()
      const targetAlreadyHas = (ownRow?.c || 0) > 0
      if (!targetAlreadyHas && userId !== req.user.id) {
        return res.status(403).json({ error: '权限不足：只有管理员可以授予「后台管理」模块' })
      }
    }
  }

  db.run('DELETE FROM user_modules WHERE user_id = ?', [userId])
  for (const mid of moduleIds) {
    try { db.run('INSERT INTO user_modules (user_id, module_id) VALUES (?, ?)', [userId, mid]) } catch(e) {}
  }
  res.json({ message: 'ok' })
})

export default router
