import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireBackendModule } from '../module-access.js'

const router = Router()

// WBS 数据字典：层级结构「项目WBS（如 N-A228） -> 车号（四位，如 0289）」
// 维护入口在「后台管理」模块内（/admin/backend 的 WBS字典维护 标签页）。
// 注意：此字典与 dict_categories（输出物分类/评分字典）完全独立。
//
// 权限：
// - 读取（GET）：所有登录用户可读（任务发布时需要选项目号/车号）
// - 维护（POST/PUT/DELETE）：需「后台管理」模块权限或管理员（见 requireBackendModule）

function rowToItem(row) {
  return {
    id: row.id,
    level: row.level,
    parentId: row.parent_id,
    code: row.code || '',
    name: row.name,
    sortOrder: row.sort_order || 0,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

// 任务上的 wbs_project_ids / wbs_car_ids 是 JSON 数字数组文本（如 "[17,18]"），
// 因此不能用 LIKE '%"17"%' 匹配（那样只对字符串元素生效）。这里按 JSON 解析后精确比较。
function parseIdList(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(Number).filter(n => Number.isFinite(n)) : []
  } catch (e) {
    return String(raw).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n))
  }
}

// 返回引用了指定 WBS 条目 id 的任务标题列表
function findReferencingTasks(db, ids) {
  if (!ids || ids.length === 0) return []
  const targets = new Set(ids.map(Number))
  const out = []
  const stmt = db.prepare(
    "SELECT id, title, wbs_project_ids, wbs_car_ids FROM tasks WHERE (wbs_project_ids IS NOT NULL AND wbs_project_ids != '') OR (wbs_car_ids IS NOT NULL AND wbs_car_ids != '')"
  )
  while (stmt.step()) {
    const row = stmt.getAsObject()
    const used = [...parseIdList(row.wbs_project_ids), ...parseIdList(row.wbs_car_ids)]
    if (used.some(u => targets.has(Number(u)))) {
      out.push({ id: row.id, title: row.title || '' })
    }
  }
  stmt.free()
  return out
}

// GET /api/wbs - 全量扁平列表
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT * FROM wbs_items ORDER BY level, sort_order, id')
  const items = rows.length > 0 ? rows[0].values.map(r => rowToItem({
    id: r[0], level: r[1], parent_id: r[2], code: r[3], name: r[4],
    sort_order: r[5], active: r[6], created_at: r[7]
  })) : []
  res.json({ items })
})

// GET /api/wbs/tree - 层级树（用于级联选择）
router.get('/tree', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.exec('SELECT * FROM wbs_items ORDER BY level, sort_order, id')
  const all = rows.length > 0 ? rows[0].values.map(r => rowToItem({
    id: r[0], level: r[1], parent_id: r[2], code: r[3], name: r[4],
    sort_order: r[5], active: r[6], created_at: r[7]
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

// POST /api/wbs - 新增（需后台管理模块权限）
// body: { level, parentId, code, name, sortOrder }
router.post('/', authMiddleware, requireBackendModule, (req, res) => {
  const { level, parentId, code, name, sortOrder } = req.body
  const lvl = Number(level)
  if (![1, 2].includes(lvl)) {
    return res.status(400).json({ error: 'level 必须是 1（项目WBS）或 2（车号）' })
  }
  const trimmedName = (name || code || '').toString().trim()
  if (!trimmedName) {
    return res.status(400).json({ error: '请填写名称/编码' })
  }
  if (lvl === 2) {
    if (!parentId) return res.status(400).json({ error: '请选择所属项目WBS' })
    const carCode = (code || name || '').toString().trim()
    if (!/^\d{4}$/.test(carCode)) {
      return res.status(400).json({ error: '车号必须为四位数字，例如 0289' })
    }
  }

  const db = getDB()
  db.run(
    `INSERT INTO wbs_items (level, parent_id, code, name, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)`,
    [lvl, lvl === 2 ? Number(parentId) : null, (code || trimmedName).toString().trim(), trimmedName, sortOrder || 0]
  )
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  res.status(201).json({ id })
})

// PUT /api/wbs/:id - 更新（需后台管理模块权限）
router.put('/:id', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const { code, name, sortOrder, active } = req.body
  const db = getDB()

  // 车号仍需保持四位数字
  const row = db.exec(`SELECT level FROM wbs_items WHERE id = ${id}`)
  const level = row.length > 0 ? row[0].values[0][0] : null
  if (level === null) return res.status(404).json({ error: 'WBS 条目不存在' })

  if (level === 2 && code !== undefined) {
    const carCode = String(code).trim()
    if (!/^\d{4}$/.test(carCode)) {
      return res.status(400).json({ error: '车号必须为四位数字，例如 0289' })
    }
  }

  const updates = []
  const params = []
  if (code !== undefined) { updates.push('code = ?'); params.push(String(code).trim()) }
  if (name !== undefined) { updates.push('name = ?'); params.push(String(name).trim()) }
  if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder) }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0) }
  if (updates.length === 0) return res.json({ message: 'ok' })
  params.push(id)
  db.run(`UPDATE wbs_items SET ${updates.join(', ')} WHERE id = ?`, params)
  res.json({ message: 'ok' })
})

// DELETE /api/wbs/:id - 删除（需后台管理模块权限）
// 注意：sql.js 下 PRAGMA foreign_keys=ON 对 ALTER/删除语句不总是生效，
// 因此这里显式级联删除下级车号，避免留下 parent_id 指向已删项目的孤儿行。
router.delete('/:id', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const exists = db.exec(`SELECT level FROM wbs_items WHERE id = ${id}`)
  if (exists.length === 0) return res.status(404).json({ error: 'WBS 条目不存在' })

  // 显式级联：先取出下级车号
  const childIds = []
  const cStmt = db.prepare('SELECT id FROM wbs_items WHERE parent_id = ?')
  cStmt.bind([id])
  while (cStmt.step()) childIds.push(cStmt.getAsObject().id)
  cStmt.free()

  // 已被任务引用时不允许删除，避免任务上的项目号/车号变成悬空数据
  const refs = findReferencingTasks(db, [id, ...childIds])
  if (refs.length > 0) {
    const names = refs.slice(0, 3).map(t => `#${t.id} ${t.title}`).join('、')
    const more = refs.length > 3 ? ` 等 ${refs.length} 个任务` : ''
    return res.status(400).json({
      error: `该项目号/车号已被任务引用（${names}${more}），无法删除，可改为禁用`,
      referencingTasks: refs
    })
  }

  for (const cid of childIds) {
    db.run('DELETE FROM wbs_items WHERE id = ?', [cid])
  }

  db.run('DELETE FROM wbs_items WHERE id = ?', [id])
  res.json({ message: 'ok', deletedChildren: childIds.length })
})

export default router
