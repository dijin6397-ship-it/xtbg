import { Router } from 'express'
import * as XLSX from 'xlsx'
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
    // 项目名称：仅项目WBS（level=1）维护，如「02A01三架项目」
    projectName: row.project_name || '',
    sortOrder: row.sort_order || 0,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

// 统一读取 wbs_items 全量行（显式列出字段，避免列顺序变化导致错位）
function selectAllItems(db) {
  const rows = db.exec('SELECT id, level, parent_id, code, name, sort_order, active, created_at, project_name FROM wbs_items ORDER BY level, sort_order, id')
  return rows.length > 0 ? rows[0].values.map(r => rowToItem({
    id: r[0], level: r[1], parent_id: r[2], code: r[3], name: r[4],
    sort_order: r[5], active: r[6], created_at: r[7], project_name: r[8]
  })) : []
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
  const items = selectAllItems(db)
  res.json({ items })
})

// GET /api/wbs/tree - 层级树（用于级联选择）
router.get('/tree', authMiddleware, (req, res) => {
  const db = getDB()
  const all = selectAllItems(db)

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
// body: { level, parentId, code, name, projectName, sortOrder }
router.post('/', authMiddleware, requireBackendModule, (req, res) => {
  const { level, parentId, code, name, projectName, sortOrder } = req.body
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
    `INSERT INTO wbs_items (level, parent_id, code, name, project_name, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [lvl, lvl === 2 ? Number(parentId) : null, (code || trimmedName).toString().trim(), trimmedName,
     lvl === 1 ? (projectName || '').toString().trim() : '', sortOrder || 0]
  )
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  res.status(201).json({ id })
})

// PUT /api/wbs/:id - 更新（需后台管理模块权限）
router.put('/:id', authMiddleware, requireBackendModule, (req, res) => {
  const id = Number(req.params.id)
  const { code, name, projectName, sortOrder, active } = req.body
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
  // 项目名称仅对项目WBS（level=1）生效
  if (projectName !== undefined && level === 1) { updates.push('project_name = ?'); params.push(String(projectName).trim()) }
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

// ---------------------------------------------------------------------------
// WBS 字典批量扩充：Excel 模板下载 + 导入（需后台管理模块权限）
// 模板列：项目号* / 项目名称 / 车号（一行一个项目号或一个车号）
// ---------------------------------------------------------------------------

const WBS_TEMPLATE_COLUMNS = [
  { key: 'project_code', header: '项目号*', hint: '项目WBS编码，如 N-A228（新增项目必填）' },
  { key: 'project_name', header: '项目名称', hint: '项目名称，如 02A01三架项目（仅项目号行填写）' },
  { key: 'car_code', header: '车号', hint: '四位数字车号，如 0289；填写时该行归属「项目号*」列对应项目，项目不存在会自动创建' }
]

// GET /api/wbs/import-template - 下载 WBS 字典导入模板（xlsx）
router.get('/import-template', authMiddleware, requireBackendModule, (req, res) => {
  const header = WBS_TEMPLATE_COLUMNS.map(c => c.header)
  const sample1 = ['N-A228', '02A01三架项目', '']
  const sample2 = ['N-A228', '', '0292']
  const aoa = [header, sample1, sample2]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 12 }]

  const hintAoa = [
    ['列名', '填写说明'],
    ...WBS_TEMPLATE_COLUMNS.map(c => [c.header, c.hint]),
    ['说明', '每行一条记录：只填「项目号+项目名称」表示新增/更新项目；填了「车号」表示在该项目下新增车号（项目不存在时自动创建）。已存在的项目号/车号不会重复创建，项目名称会被更新。']
  ]
  const wsHint = XLSX.utils.aoa_to_sheet(hintAoa)
  wsHint['!cols'] = [{ wch: 16 }, { wch: 90 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'WBS导入')
  XLSX.utils.book_append_sheet(wb, wsHint, '填写说明')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="wbs-import-template.xlsx"')
  res.send(buf)
})

// POST /api/wbs/import - 批量导入 WBS 字典（需后台管理模块权限）
// body: { fileBase64 }
// 返回：{ total, createdProjects, updatedProjects, createdCars, skipped, errors }
router.post('/import', authMiddleware, requireBackendModule, (req, res) => {
  const { fileBase64 } = req.body || {}
  if (!fileBase64) return res.status(400).json({ error: '请上传 Excel 文件' })

  let wb
  try {
    const buf = Buffer.from(String(fileBase64).replace(/^data:.*?;base64,/, ''), 'base64')
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  } catch (e) {
    return res.status(400).json({ error: 'Excel 文件解析失败：' + e.message })
  }

  const sheetName = wb.SheetNames.find(n => n === 'WBS导入') || wb.SheetNames[0]
  if (!sheetName) return res.status(400).json({ error: 'Excel 中没有工作表' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false })
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Excel 中没有数据行' })
  if (rows.length > 2000) return res.status(400).json({ error: `单次最多导入 2000 条，当前 ${rows.length} 条` })

  const db = getDB()
  const errors = []
  let createdProjects = 0, updatedProjects = 0, createdCars = 0, skipped = 0

  // 项目号 -> { id, name } 缓存（含本次新建），避免同文件内重复查询/创建
  const projectCache = new Map()
  const findProject = (code) => {
    if (projectCache.has(code)) return projectCache.get(code)
    const stmt = db.prepare('SELECT id, name, project_name FROM wbs_items WHERE level = 1 AND (code = ? OR name = ?) LIMIT 1')
    stmt.bind([code, code])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    const found = row ? { id: row.id, name: row.name, projectName: row.project_name || '' } : null
    projectCache.set(code, found)
    return found
  }
  const findCar = (parentId, code) => {
    const stmt = db.prepare('SELECT id FROM wbs_items WHERE level = 2 AND parent_id = ? AND (code = ? OR name = ?) LIMIT 1')
    stmt.bind([parentId, code, code])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    return row
  }
  const maxSort = () => {
    const r = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM wbs_items')
    return r[0]?.values[0]?.[0] || 0
  }

  rows.forEach((raw, idx) => {
    const rowNo = idx + 2
    const get = (key) => {
      const col = WBS_TEMPLATE_COLUMNS.find(c => c.key === key)
      if (!col) return ''
      const v = raw[col.header]
      return v === undefined || v === null ? '' : String(v).trim()
    }

    const projectCode = get('project_code')
    const projectName = get('project_name')
    // 车号容错：Excel 可能把 0289 读成数字 289，这里补零到四位
    let carCode = get('car_code')
    if (carCode && /^\d{1,4}$/.test(carCode)) carCode = carCode.padStart(4, '0')

    if (!projectCode && !carCode) { skipped++; return }
    if (!projectCode) {
      errors.push({ row: rowNo, message: '缺少项目号，无法确定车号归属' })
      return
    }
    if (carCode && !/^\d{4}$/.test(carCode)) {
      errors.push({ row: rowNo, message: `车号「${carCode}」必须为四位数字，例如 0289` })
      return
    }

    // 项目：存在则（按需）更新项目名称，不存在则创建
    let proj = findProject(projectCode)
    if (!proj) {
      db.run(
        `INSERT INTO wbs_items (level, parent_id, code, name, project_name, sort_order, active) VALUES (1, NULL, ?, ?, ?, ?, 1)`,
        [projectCode, projectCode, projectName, maxSort() + 1]
      )
      const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
      proj = { id, name: projectCode, projectName }
      projectCache.set(projectCode, proj)
      createdProjects++
    } else if (projectName && projectName !== proj.projectName) {
      db.run('UPDATE wbs_items SET project_name = ? WHERE id = ?', [projectName, proj.id])
      proj.projectName = projectName
      projectCache.set(projectCode, proj)
      updatedProjects++
    } else if (!carCode) {
      // 项目已存在且名称无变化：视为跳过（幂等）
      skipped++
    }

    // 车号：存在则跳过，不存在则创建
    if (carCode) {
      const exist = findCar(proj.id, carCode)
      if (exist) {
        skipped++
      } else {
        db.run(
          `INSERT INTO wbs_items (level, parent_id, code, name, project_name, sort_order, active) VALUES (2, ?, ?, ?, '', ?, 1)`,
          [proj.id, carCode, carCode, maxSort() + 1]
        )
        createdCars++
      }
    }
  })

  res.json({
    success: true,
    total: rows.length,
    createdProjects,
    updatedProjects,
    createdCars,
    skipped,
    errors
  })
})

export default router
