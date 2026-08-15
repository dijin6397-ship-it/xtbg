import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

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

router.put('/:userId', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' })
  const db = getDB()
  const userId = Number(req.params.userId)
  const { moduleIds } = req.body
  if (!Array.isArray(moduleIds)) return res.status(400).json({ error: 'moduleIds must be array' })
  db.run('DELETE FROM user_modules WHERE user_id = ?', [userId])
  for (const mid of moduleIds) {
    try { db.run('INSERT INTO user_modules (user_id, module_id) VALUES (?, ?)', [userId, mid]) } catch(e) {}
  }
  res.json({ message: 'ok' })
})

export default router
