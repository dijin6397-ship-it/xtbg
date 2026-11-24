import { Router } from 'express'
import * as XLSX from 'xlsx'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireBackendModule } from '../module-access.js'

const router = Router()

// 分类字典的维护接口（POST/PUT/DELETE）需要「后台管理」模块权限或管理员，
// 与 WBS 字典、账号管理保持一致：拥有 admin_backend 模块即可维护。
// 读取接口（GET）对所有登录用户开放，任务反馈/报表需要读取分类。

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

function categoryByLevelAndName(db, level, name, parentId = null) {
  const stmt = db.prepare('SELECT * FROM dict_categories WHERE level = ? AND name = ? AND (parent_id IS ? OR parent_id = ?) LIMIT 1')
  stmt.bind([Number(level), String(name || '').trim(), parentId, parentId])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row ? rowToCategory(row) : null
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
router.post('/', authMiddleware, requireBackendModule, (req, res) => {
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
router.put('/:id', authMiddleware, requireBackendModule, (req, res) => {
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
router.delete('/:id', authMiddleware, requireBackendModule, (req, res) => {
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

// GET /api/dictionary/import-template - three-level category import template
router.get('/import-template', authMiddleware, requireBackendModule, (req, res) => {
  const headers = ['一级分类名称', '二级分类名称', '三级分类名称', '分值规则', '分值下限/固定分值', '分值上限']
  const rows = [
    ['固资', '设备管理', '设备维修', 'fixed', 3, ''],
    ['安全', '现场安全', '隐患整改', 'range', 1, 5],
    ['体系内外审', '内部审核', '', 'fixed', 2, '']
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '分类导入')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="dictionary-import-template.xlsx"')
  res.send(buf)
})

// POST /api/dictionary/import - upsert three-level categories
router.post('/import', authMiddleware, requireBackendModule, (req, res) => {
  const { fileBase64 } = req.body || {}
  if (!fileBase64) return res.status(400).json({ error: '请上传 Excel 文件' })

  let workbook
  try {
    const buffer = Buffer.from(String(fileBase64).replace(/^data:.*?;base64,/, ''), 'base64')
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch (error) {
    return res.status(400).json({ error: 'Excel 文件解析失败：' + error.message })
  }

  const sheetName = workbook.SheetNames.find(name => name === '分类导入') || workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
  if (!rows.length) return res.status(400).json({ error: 'Excel 中没有数据行' })

  const db = getDB()
  const errors = []
  let created = 0
  let updated = 0

  rows.forEach((raw, index) => {
    const rowNo = index + 2
    const value = key => String(raw[key] ?? '').trim()
    const level1Name = value('一级分类名称')
    const level2Name = value('二级分类名称')
    const level3Name = value('三级分类名称')
    const scoreRuleRaw = value('分值规则').toLowerCase()
    const scoreRule = ['fixed', 'range', 'any'].includes(scoreRuleRaw)
      ? scoreRuleRaw
      : ({ '单值': 'fixed', '区间': 'range', '任意': 'any' }[value('分值规则')] || 'fixed')
    const scoreValue = Number(value('分值下限/固定分值') || 0)
    const scoreUpper = Number(value('分值上限') || 0)

    if (!level1Name) {
      errors.push({ row: rowNo, message: '一级分类名称为必填项' })
      return
    }
    if (level2Name && !level3Name) {
      errors.push({ row: rowNo, message: '已填写二级分类时，三级分类名称不能为空' })
      return
    }
    if (scoreRule === 'range' && (!Number.isFinite(scoreValue) || !Number.isFinite(scoreUpper) || scoreValue > scoreUpper)) {
      errors.push({ row: rowNo, message: '分值区间无效，下限必须不大于上限' })
      return
    }

    let level1 = categoryByLevelAndName(db, 1, level1Name)
    if (!level1) {
      db.run(`INSERT INTO dict_categories (level, parent_id, name, score_rule, sort_order, active)
              VALUES (1, NULL, ?, 'fixed', ?, 1)`, [level1Name, index + 1])
      level1 = categoryByLevelAndName(db, 1, level1Name)
      created++
    }
    if (!level2Name) return

    let level2 = categoryByLevelAndName(db, 2, level2Name, level1.id)
    if (!level2) {
      db.run(`INSERT INTO dict_categories (level, parent_id, name, score_rule, sort_order, active)
              VALUES (2, ?, ?, 'fixed', ?, 1)`, [level1.id, level2Name, index + 1])
      level2 = categoryByLevelAndName(db, 2, level2Name, level1.id)
      created++
    }

    const existing = categoryByLevelAndName(db, 3, level3Name, level2.id)
    if (existing) {
      db.run(`UPDATE dict_categories SET score_rule = ?, score_value = ?, score_upper = ?, active = 1 WHERE id = ?`,
        [scoreRule, scoreValue, scoreUpper, existing.id])
      updated++
    } else {
      db.run(`INSERT INTO dict_categories (level, parent_id, name, score_rule, score_value, score_upper, sort_order, active)
              VALUES (3, ?, ?, ?, ?, ?, ?, 1)`,
        [level2.id, level3Name, scoreRule, scoreValue, scoreUpper, index + 1])
      created++
    }
  })

  res.json({
    success: true,
    total: rows.length,
    created,
    updated,
    failed: errors.length,
    errors
  })
})

// GET /api/dictionary/report - full task report expanded by subtask/output
router.get('/report', authMiddleware, (req, res) => {
  const db = getDB()
  const { user_id, l1, l2, l3, start_date, end_date, status } = req.query

  let sql = `
    SELECT o.id as output_id, o.user_id, o.content, o.status, o.score_value, o.score_quantity,
           o.score_total, o.score_rule, o.category_l1, o.category_l2, o.category_l3,
           o.created_at, o.reviewed_at,
           ou.name as user_name,
           s.id as row_subtask_id, s.title as subtask_title, s.deadline as subtask_deadline,
           su.id as subtask_assignee_id, su.name as subtask_assignee_name,
           t.id as task_id, t.title as task_title, t.description as task_description,
           t.task_type as task_type, t.management_category, t.management_detail,
           t.created_at as task_created_at, t.deadline as task_deadline,
           t.status as task_status, t.progress as task_progress,
           t.supervisor_id as task_supervisor_id, t.publisher_id as task_publisher_id,
           t.wbs_project_ids as task_wbs_project_ids, t.wbs_car_ids as task_wbs_car_ids,
           sup.name as supervisor_name,
           pub.name as publisher_name
    FROM tasks t
    LEFT JOIN subtasks s ON s.task_id = t.id
    LEFT JOIN users su ON s.assignee_id = su.id
    LEFT JOIN task_outputs o ON o.task_id = t.id
      AND (o.subtask_id = s.id OR (s.id IS NULL AND o.subtask_id IS NULL))
    LEFT JOIN users ou ON o.user_id = ou.id
    LEFT JOIN users sup ON t.supervisor_id = sup.id
    LEFT JOIN users pub ON t.publisher_id = pub.id
    WHERE 1=1
  `
  const params = []
  if (user_id) {
    sql += ' AND (s.assignee_id = ? OR o.user_id = ?)'
    params.push(Number(user_id), Number(user_id))
  }
  if (l1 || l2 || l3) sql += ' AND o.id IS NOT NULL'
  if (l1) { sql += ' AND o.category_l1 = ?'; params.push(Number(l1)) }
  if (l2) { sql += ' AND o.category_l2 = ?'; params.push(Number(l2)) }
  if (l3) { sql += ' AND o.category_l3 = ?'; params.push(Number(l3)) }
  if (status) { sql += ' AND o.status = ?'; params.push(status) }
  if (start_date) {
    sql += ' AND (date(o.created_at) >= date(?) OR (o.id IS NULL AND date(t.created_at) >= date(?)))'
    params.push(start_date, start_date)
  }
  if (end_date) {
    sql += ' AND (date(o.created_at) <= date(?) OR (o.id IS NULL AND date(t.created_at) <= date(?)))'
    params.push(end_date, end_date)
  }
  sql += ' ORDER BY t.id DESC, s.id ASC, o.created_at DESC'

  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    rows.push({
      id: row.output_id,
      outputId: row.output_id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      taskDescription: row.task_description || '',
      taskProgress: row.task_progress || 0,
      taskType: row.task_type,
      managementCategory: row.management_category || '',
      managementDetail: row.management_detail || '',
      taskCreatedAt: row.task_created_at,
      taskDeadline: row.task_deadline,
      taskStatus: row.task_status,
      taskWbsProjectIds: row.task_wbs_project_ids || '',
      taskWbsCarIds: row.task_wbs_car_ids || '',
      supervisorName: row.supervisor_name,
      publisherName: row.publisher_name || '',
      userId: row.user_id,
      userName: row.user_name,
      department: row.department,
      subtaskId: row.row_subtask_id,
      subtaskTitle: row.subtask_title || '',
      subtaskDeadline: row.subtask_deadline || '',
      subtaskAssigneeId: row.subtask_assignee_id,
      subtaskAssigneeName: row.subtask_assignee_name || '',
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

  // 解析任务上的 WBS 项目号 / 车号（JSON 数组文本），并带出项目名称，
  // 供报表/导出展示「项目号 / 项目名称 / 车号」列。
  const parseIdList = (raw) => {
    if (!raw) return []
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.map(Number).filter(n => Number.isFinite(n)) : []
    } catch (e) {
      return String(raw).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n))
    }
  }
  const wbsIdSet = new Set()
  for (const r of rows) {
    for (const i of parseIdList(r.taskWbsProjectIds)) wbsIdSet.add(i)
    for (const i of parseIdList(r.taskWbsCarIds)) wbsIdSet.add(i)
  }
  const wbsMap = {}
  const wbsIds = Array.from(wbsIdSet)
  if (wbsIds.length > 0) {
    const placeholders = wbsIds.map(() => '?').join(',')
    const wStmt = db.prepare(`SELECT id, level, parent_id, code, name, project_name FROM wbs_items WHERE id IN (${placeholders})`)
    wStmt.bind(wbsIds)
    while (wStmt.step()) {
      const w = wStmt.getAsObject()
      wbsMap[w.id] = { id: w.id, level: w.level, parentId: w.parent_id, code: w.code || '', name: w.name, projectName: w.project_name || '' }
    }
    wStmt.free()
  }
  for (const r of rows) {
    const projects = parseIdList(r.taskWbsProjectIds).map(i => wbsMap[i]).filter(Boolean)
    const cars = parseIdList(r.taskWbsCarIds).map(i => wbsMap[i]).filter(Boolean)
    // 车号所属项目（项目号列为空时用车号归属项目兜底）
    const carParentIds = Array.from(new Set(cars.map(c => c.parentId).filter(Boolean)))
    const carParents = carParentIds.map(i => wbsMap[i]).filter(Boolean)
    const allProjects = [...projects, ...carParents.filter(p => !projects.some(x => x.id === p.id))]
    r.wbsProjectCodes = allProjects.map(p => p.code || p.name)
    r.wbsProjectNames = allProjects.map(p => p.projectName || p.name)
    r.wbsCarNames = cars.map(c => c.code || c.name)
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
    const userId = r.subtaskAssigneeId || r.userId
    const userName = r.subtaskAssigneeName || r.userName
    if (userId) {
      const key = userId
      if (!byUser[key]) byUser[key] = { userId, userName, count: 0, total: 0 }
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
