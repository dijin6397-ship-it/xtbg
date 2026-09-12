import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/supervision - List supervision logs
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const { type, task_id } = req.query

  let sql = `
    SELECT sl.*, 
      t.title as task_title,
      o.name as operator_name,
      tgt.name as target_name
    FROM supervision_logs sl
    LEFT JOIN tasks t ON sl.task_id = t.id
    LEFT JOIN users o ON sl.operator_id = o.id
    LEFT JOIN users tgt ON sl.target_id = tgt.id
    WHERE 1=1
  `
  const params = []

  if (type) { sql += ' AND sl.type = ?'; params.push(type) }
  if (task_id) { sql += ' AND sl.task_id = ?'; params.push(Number(task_id)) }

  sql += ' ORDER BY sl.created_at DESC'

  const stmt = db.prepare(sql)
  stmt.bind(params)

  const logs = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    logs.push({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      type: row.type,
      operator: { id: row.operator_id, name: row.operator_name },
      target: { id: row.target_id, name: row.target_name },
      content: row.content,
      time: row.created_at
    })
  }
  stmt.free()

  res.json({ logs })
})

// GET /api/supervision/stats
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDB()

  const overdue = db.exec("SELECT COUNT(*) FROM tasks WHERE status = 'overdue'")[0]?.values[0]?.[0] || 0
  const urgeCount = db.exec("SELECT COUNT(*) FROM supervision_logs WHERE type = 'urge'")[0]?.values[0]?.[0] || 0
  const warnCount = db.exec("SELECT COUNT(*) FROM supervision_logs WHERE type = 'warn'")[0]?.values[0]?.[0] || 0
  const escalatedCount = db.exec("SELECT COUNT(*) FROM supervision_logs WHERE type = 'escalate'")[0]?.values[0]?.[0] || 0

  res.json({ overdue, urgeCount, warnCount, escalatedCount })
})

export default router
