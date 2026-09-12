import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function requireAdmin(req, res) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' })
    return false
  }
  return true
}

function rowToCategory(row) {
  return {
    id: row.id,
    level: row.level,
    parentId: row.parent_id,
    code: row.code || '',
    name: row.name,
    scoreRule: row.score_rule || 'fixed',
    scoreValue: row.score_value || 0,
    scoreUpper: row.score_upper || 0,
    sortOrder: row.sort_order || 0,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

// GET /api/dictionary - list whole tree (flat array with level / parentId)
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT * FROM dict_categories ORDER BY level, sort_order, id')
  const categories = rows.length > 0 ? rows[0].values.map(r => rowToCategory({
    id: r[0], level: r[1], parent_id: r[2], code: r[3], name: r[4],
    score_rule: r[5], score_value: r[6], score_upper: r[7], sort_order: r[8],
    active: r[9], created_at: r[10]
  })) : []
  res.json({ categories })
})

// GET /api/dictionary/tree - hierarchical tree useful for cascading selects
router.get('/tree', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT * FROM dict_categories ORDER BY level, sort_order, id')
  const all = rows.length > 0 ? rows[0].values.map(r => rowToCategory({
    id: r[0], level: r[1], parent_id: r[2], code: r[3], name: r[4],
    score_rule: r[5], score_value: r[6], score_upper: r[7], sort_order: r[8],
    active: r[9], created_at: r[10]
  })) : []

  const byParent = {}
  for (const c of all) {
    const key = c.parentId || 0
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(c)
  }

  const build = (parentId) => (byParent[parentId] || []).map(c => ({
    ...c,
    children: build(c.id)
  }))

  res.json({ tree: build(0) })
})

// POST /api/dictionary - create a category (admin)
router.post('/', authMiddleware, (req, res) => {
  if (!requireAdmin(req, res)) return
  const { level, parentId, name, scoreRule, scoreValue, scoreUpper, sortOrder } = req.body
  if (!level || ![1, 2, 3].includes(Number(level))) {
    return res.status(400).json({ error: 'level 必须是 1 / 2 / 3' })
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请填写分类名称' })
  }
  const lvl = Number(level)
  if (lvl > 1 && !parentId) {
    return res.status(400).json({ error: '请选择上级分类' })
  }
  if (lvl === 1) {
    if (!['固资', '安全', '合同', '制度管理', '体系内外审', '信息化', '绩效', '考勤', '报销', '其他'].includes(name.trim())) {
      // Allow any L1 name, but recommend the canonical list - non-fatal.
    }
  }
  const db = getDB()
  db.run(`INSERT INTO dict_categories (level, parent_id, name, score_rule, score_value, score_upper, sort_order, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [lvl, parentId || null, name.trim(), scoreRule || 'fixed', scoreValue || 0, scoreUpper || 0, sortOrder || 0])
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  res.status(201).json({ id })
})

// PUT /api/dictionary/:id - update a category
router.put('/:id', authMiddleware, (req, res) => {
  if (!requireAdmin(req, res)) return
  const id = Number(req.params.id)
  const { name, scoreRule, scoreValue, scoreUpper, sortOrder, active } = req.body
  const db = getDB()
  const updates = []
  const params = []
  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()) }
  if (scoreRule !== undefined) { updates.push('score_rule = ?'); params.push(scoreRule) }
  if (scoreValue !== undefined) { updates.push('score_value = ?'); params.push(scoreValue) }
  if (scoreUpper !== undefined) { updates.push('score_upper = ?'); params.push(scoreUpper) }
  if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder) }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0) }
  if (updates.length === 0) return res.json({ message: 'ok' })
  params.push(id)
  db.run(`UPDATE dict_categories SET ${updates.join(', ')} WHERE id = ?`, params)
  res.json({ message: 'ok' })
})

// DELETE /api/dictionary/:id - delete a category (cascade children)
router.delete('/:id', authMiddleware, (req, res) => {
  if (!requireAdmin(req, res)) return
  const id = Number(req.params.id)
  const db = getDB()
  // Reject if any task_output references this category
  const used = db.exec(`SELECT COUNT(*) FROM task_outputs WHERE category_l1 = ? OR category_l2 = ? OR category_l3 = ?`, [id, id, id])
  if (used[0]?.values[0]?.[0] > 0) {
    return res.status(400).json({ error: '该分类已被输出物引用，无法删除' })
  }
  db.run('DELETE FROM dict_categories WHERE id = ?', [id])
  res.json({ message: 'ok' })
})

// GET /api/dictionary/level/:level - list categories by level (optionally filtered by parentId)
router.get('/level/:level', authMiddleware, (req, res) => {
  const level = Number(req.params.level)
  const parentId = req.query.parentId ? Number(req.query.parentId) : null
  const db = getDB()
  let sql = 'SELECT * FROM dict_categories WHERE level = ? AND active = 1'
  const params = [level]
  if (parentId) { sql += ' AND parent_id = ?'; params.push(parentId) }
  sql += ' ORDER BY sort_order, id'
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    out.push({
      id: row.id, level: row.level, parentId: row.parent_id,
      name: row.name, scoreRule: row.score_rule,
      scoreValue: row.score_value || 0, scoreUpper: row.score_upper || 0,
      sortOrder: row.sort_order || 0, active: row.active === 1
    })
  }
  stmt.free()
  res.json({ categories: out })
})

// GET /api/dictionary/report - report aggregation by category + user + time
router.get('/report', authMiddleware, (req, res) => {
  const db = getDB()
  const { user_id, l1, l2, l3, start_date, end_date, status } = req.query

  let sql = `
    SELECT o.id, o.task_id, o.user_id, o.content, o.status, o.score_value, o.score_quantity, o.score_total, o.score_rule,
           o.category_l1, o.category_l2, o.category_l3, o.created_at, o.reviewed_at,
           u.name as user_name, u.department,
           t.title as task_title, t.task_type as task_type, t.created_at as task_created_at,
           t.deadline as task_deadline, t.status as task_status, t.supervisor_id as task_supervisor_id,
           sup.name as supervisor_name
    FROM task_outputs o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN tasks t ON o.task_id = t.id
    LEFT JOIN users sup ON t.supervisor_id = sup.id
    WHERE 1=1
  `
  const params = []
  if (user_id) { sql += ' AND o.user_id = ?'; params.push(Number(user_id)) }
  if (l1) { sql += ' AND o.category_l1 = ?'; params.push(Number(l1)) }
  if (l2) { sql += ' AND o.category_l2 = ?'; params.push(Number(l2)) }
  if (l3) { sql += ' AND o.category_l3 = ?'; params.push(Number(l3)) }
  if (status) { sql += ' AND o.status = ?'; params.push(status) }
  if (start_date) { sql += ' AND date(o.created_at) >= date(?)'; params.push(start_date) }
  if (end_date) { sql += ' AND date(o.created_at) <= date(?)'; params.push(end_date) }
  sql += ' ORDER BY o.created_at DESC'

  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    rows.push({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      taskType: row.task_type,
      taskCreatedAt: row.task_created_at,
      taskDeadline: row.task_deadline,
      taskStatus: row.task_status,
      supervisorName: row.supervisor_name,
      userId: row.user_id,
      userName: row.user_name,
      department: row.department,
      content: row.content,
      status: row.status,
      scoreValue: row.score_value || 0,
      scoreQuantity: row.score_quantity || 0,
      scoreTotal: row.score_total || 0,
      scoreRule: row.score_rule || '',
      categoryL1: row.category_l1,
      categoryL2: row.category_l2,
      categoryL3: row.category_l3,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at
    })
  }
  stmt.free()

  // Resolve category names
  const catIds = Array.from(new Set(rows.flatMap(r => [r.categoryL1, r.categoryL2, r.categoryL3]).filter(Boolean)))
  const catMap = {}
  if (catIds.length > 0) {
    const placeholders = catIds.map(() => '?').join(',')
    const cStmt = db.prepare(`SELECT id, name, level FROM dict_categories WHERE id IN (${placeholders})`)
    cStmt.bind(catIds)
    while (cStmt.step()) {
      const c = cStmt.getAsObject()
      catMap[c.id] = { name: c.name, level: c.level }
    }
    cStmt.free()
  }

  for (const r of rows) {
    r.categoryL1Name = r.categoryL1 ? (catMap[r.categoryL1]?.name || '') : ''
    r.categoryL2Name = r.categoryL2 ? (catMap[r.categoryL2]?.name || '') : ''
    r.categoryL3Name = r.categoryL3 ? (catMap[r.categoryL3]?.name || '') : ''
  }

  // Aggregations
  const byUser = {}
  const byL1 = {}
  const byL3 = {}
  let grandTotal = 0
  let count = 0
  for (const r of rows) {
    count++
    grandTotal += r.scoreTotal || 0
    if (r.userId) {
      const key = r.userId
      if (!byUser[key]) byUser[key] = { userId: r.userId, userName: r.userName, count: 0, total: 0 }
      byUser[key].count++
      byUser[key].total += r.scoreTotal || 0
    }
    if (r.categoryL1) {
      const key = r.categoryL1
      if (!byL1[key]) byL1[key] = { id: r.categoryL1, name: r.categoryL1Name, count: 0, total: 0 }
      byL1[key].count++
      byL1[key].total += r.scoreTotal || 0
    }
    if (r.categoryL3) {
      const key = r.categoryL3
      if (!byL3[key]) byL3[key] = { id: r.categoryL3, name: r.categoryL3Name, count: 0, total: 0 }
      byL3[key].count++
      byL3[key].total += r.scoreTotal || 0
    }
  }

  res.json({
    rows,
    summary: {
      totalCount: count,
      grandTotal: Math.round(grandTotal * 100) / 100,
      byUser: Object.values(byUser),
      byL1: Object.values(byL1),
      byL3: Object.values(byL3)
    }
  })
})

export default router
