import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT id, code, name FROM departments ORDER BY code')
  const departments = rows.length > 0 ? rows[0].values.map(r => ({ id: r[0], code: r[1], name: r[2] })) : []
  res.json({ departments })
})

export default router
