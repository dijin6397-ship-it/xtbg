import { Router } from 'express'
import * as XLSX from 'xlsx'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission, PERMISSIONS } from '../permissions.js'

const router = Router()

// ---------------------------------------------------------------------------
// 任务导入 / 模板下载
// 独立权限：task_import（通过账号管理页面配置给指定用户）
// ---------------------------------------------------------------------------

const taskTypeLabels = {
  self_repair: '自主修',
  rectification: '问题整改',
  quality_analysis: '现场质量问题分析',
  key_work: '部门重点工作',
  daily_management: '部门日常管理'
}

// 中文标签 / 英文 key 双向映射，导入时两者都接受
const taskTypeByLabel = {
  '自主修': 'self_repair',
  '问题整改': 'rectification',
  '现场质量问题分析': 'quality_analysis',
  '现场质量问题': 'quality_analysis',
  '部门重点工作': 'key_work',
  '重点工作': 'key_work',
  '部门日常管理': 'daily_management',
  '日常管理': 'daily_management'
}

const priorityByLabel = {
  '紧急': 'urgent',
  '重要': 'high',
  '普通': 'normal',
  '低优': 'low',
  '低': 'low'
}

const TEMPLATE_COLUMNS = [
  { key: 'task_type', header: '任务类型*', hint: '自主修/问题整改/现场质量问题分析/部门重点工作/部门日常管理' },
  { key: 'title', header: '任务标题*', hint: '必填，如：3号线电气故障处置' },
  { key: 'description', header: '任务描述', hint: '任务的具体内容说明' },
  { key: 'priority', header: '优先级', hint: '紧急/重要/普通/低优，留空为普通' },
  { key: 'deadline', header: '截止日期*', hint: '格式 YYYY-MM-DD，如 2026-05-20' },
  { key: 'wbs_project', header: '项目号(WBS)', hint: '可多选，多个用、分隔，如 N-A228、N-A229' },
  { key: 'wbs_car', header: '车号', hint: '可多选，四位数字，多个用、分隔，如 0289、0290' },
  { key: 'supervisor', header: '主管', hint: '主管姓名，留空则默认为发起人本人（谁发起谁审核）' },
  { key: 'assignees', header: '责任人', hint: '多个用、分隔，如 杨晨、曹毅峰' },
  { key: 'management_category', header: '管理类别', hint: '仅部门日常管理任务需要，如 固资/安全/合同' },
  { key: 'management_detail', header: '其他说明', hint: '管理类别选择“其他”时填写' }
]

function taskTypeOf(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (taskTypeLabels[v]) return v
  return taskTypeByLabel[v] || ''
}

function priorityOf(raw) {
  const v = String(raw || '').trim()
  if (!v) return 'normal'
  if (['urgent', 'high', 'normal', 'low'].includes(v)) return v
  return priorityByLabel[v] || 'normal'
}

function splitList(raw) {
  return String(raw || '').split(/[、,，;；\/\|\s]+/).map(s => s.trim()).filter(Boolean)
}

// 日期归一化：支持 Date 对象 / Excel 序列号 / 字符串
function normalizeDate(raw) {
  if (raw === null || raw === undefined || raw === '') return ''
  if (raw instanceof Date) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof raw === 'number') {
    // Excel 序列号（1900 日期系统）
    const ms = Math.round((raw - 25569) * 86400 * 1000)
    const dt = new Date(ms)
    if (isNaN(dt.getTime())) return ''
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dt.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(raw).trim()
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  return ''
}

function findUserByName(db, name) {
  const v = String(name || '').trim()
  if (!v) return null
  const stmt = db.prepare('SELECT id, name FROM users WHERE active = 1 AND (name = ? OR username = ?) LIMIT 1')
  stmt.bind([v, v])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row
}

function resolveWbsByText(db, text, level, parentId) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = splitList(raw)
  const out = []
  for (const part of parts) {
    let sql = 'SELECT id, code, name FROM wbs_items WHERE level = ? AND (code = ? OR name = ?)'
    const params = [level, part, part]
    if (parentId) { sql += ' AND parent_id = ?'; params.push(parentId) }
    sql += ' LIMIT 1'
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    if (row && !out.some(o => o.id === row.id)) out.push({ id: row.id, code: row.code, name: row.name })
  }
  return out
}

// ---------------------------------------------------------------------------
// GET /api/task-import/template - 下载导入模板（xlsx）
// ---------------------------------------------------------------------------
router.get('/template', authMiddleware, requirePermission(PERMISSIONS.TASK_IMPORT), (req, res) => {
  const db = getDB()

  // 用真实字典数据生成示例，便于填写
  const wbsRows = db.exec('SELECT code, name FROM wbs_items WHERE level = 1 ORDER BY sort_order LIMIT 3')
  const wbsSamples = wbsRows.length > 0 ? wbsRows[0].values.map(r => r[0] || r[1]).join('、') : 'N-A228'
  const carRows = db.exec('SELECT code FROM wbs_items WHERE level = 2 ORDER BY sort_order LIMIT 3')
  const carSamples = carRows.length > 0 ? carRows[0].values.map(r => r[0]).join('、') : '0289、0290'

  const header = TEMPLATE_COLUMNS.map(c => c.header)
  const sample = [
    '自主修',
    '生产异常处置（3号线电气故障）',
    '3号线生产过程中出现电气控制系统异常，PLC通讯中断导致产线停机。',
    '紧急',
    '2026-05-20',
    wbsSamples,
    carSamples,
    '李俊南',
    '杨晨、曹毅峰',
    '',
    ''
  ]
  const sample2 = [
    '部门日常管理',
    '日常设备点检',
    '按周完成设备点检并记录。',
    '普通',
    '2026-06-30',
    '',
    '',
    '',
    '',
    '安全',
    ''
  ]

  const aoa = [header, sample, sample2]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // 列宽
  ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, Math.min(46, c.hint.length * 1.4)) }))

  // 表头注释（第二行说明）—— 追加一个说明 sheet，避免破坏数据行
  const hintAoa = [
    ['列名', '填写说明'],
    ...TEMPLATE_COLUMNS.map(c => [c.header, c.hint])
  ]
  const wsHint = XLSX.utils.aoa_to_sheet(hintAoa)
  wsHint['!cols'] = [{ wch: 18 }, { wch: 70 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '任务导入')
  XLSX.utils.book_append_sheet(wb, wsHint, '填写说明')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="task-import-template.xlsx"')
  res.send(buf)
})

// ---------------------------------------------------------------------------
// POST /api/task-import/import
// body: { fileBase64: string, fileName?: string, dryRun?: boolean }
// 返回：{ created: n, failed: n, errors: [{ row, message }], tasks: [...] }
// ---------------------------------------------------------------------------
router.post('/import', authMiddleware, requirePermission(PERMISSIONS.TASK_IMPORT), (req, res) => {
  const { fileBase64, dryRun } = req.body || {}
  if (!fileBase64) {
    return res.status(400).json({ error: '请上传 Excel 文件' })
  }

  let wb
  try {
    const buf = Buffer.from(String(fileBase64).replace(/^data:.*?;base64,/, ''), 'base64')
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  } catch (e) {
    return res.status(400).json({ error: 'Excel 文件解析失败：' + e.message })
  }

  const sheetName = wb.SheetNames.find(n => n === '任务导入') || wb.SheetNames[0]
  if (!sheetName) return res.status(400).json({ error: 'Excel 中没有工作表' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false })

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Excel 中没有数据行' })
  }
  if (rows.length > 500) {
    return res.status(400).json({ error: `单次最多导入 500 条，当前 ${rows.length} 条` })
  }

  const db = getDB()
  const userRole = req.user.role
  const publisherId = req.user.id
  const importBatch = 'IMP' + Date.now()

  const errors = []
  const createdIds = []

  // 角色可发起的任务类型（与 POST /api/tasks 保持一致）
  const allowedTaskTypes = []
  if (['leader', 'supervisor', 'admin'].includes(userRole)) {
    allowedTaskTypes.push('self_repair', 'rectification', 'quality_analysis')
  }
  if (['leader', 'admin'].includes(userRole)) allowedTaskTypes.push('key_work')
  allowedTaskTypes.push('daily_management')

  rows.forEach((raw, idx) => {
    const rowNo = idx + 2 // 表头占第 1 行
    const get = (key) => {
      const col = TEMPLATE_COLUMNS.find(c => c.key === key)
      if (!col) return ''
      const v = raw[col.header]
      return v === undefined || v === null ? '' : String(v).trim()
    }

    const typeLabel = get('task_type')
    const taskType = taskTypeOf(typeLabel)
    if (!taskType) {
      errors.push({ row: rowNo, message: `任务类型无法识别：「${typeLabel}」，可选：自主修/问题整改/现场质量问题分析/部门重点工作/部门日常管理` })
      return
    }
    if (!allowedTaskTypes.includes(taskType)) {
      errors.push({ row: rowNo, message: `当前角色（${userRole}）无权发起「${taskTypeLabels[taskType]}」任务` })
      return
    }

    const title = get('title')
    if (!title) {
      errors.push({ row: rowNo, message: '任务标题为必填项' })
      return
    }

    const deadline = normalizeDate(get('deadline'))
    if (!deadline) {
      errors.push({ row: rowNo, message: '截止日期为必填项，格式 YYYY-MM-DD' })
      return
    }

    const description = get('description')
    const priority = priorityOf(get('priority'))
    const managementCategory = get('management_category')
    const managementDetail = get('management_detail')

    // WBS 项目号 / 车号
    const wbsProjects = resolveWbsByText(db, get('wbs_project'), 1, null)
    if (get('wbs_project') && wbsProjects.length === 0) {
      errors.push({ row: rowNo, message: `项目号(WBS)「${get('wbs_project')}」在 WBS 字典中不存在` })
      return
    }
    const wbsCars = []
    for (const proj of wbsProjects) {
      for (const car of resolveWbsByText(db, get('wbs_car'), 2, proj.id)) {
        if (!wbsCars.some(c => c.id === car.id)) wbsCars.push(car)
      }
    }
    if (get('wbs_car') && wbsCars.length === 0) {
      errors.push({ row: rowNo, message: `车号「${get('wbs_car')}」在 WBS 字典中不存在（需先选择项目号）` })
      return
    }

    // 主管
    let supId = null
    const supervisorName = get('supervisor')
    if (supervisorName) {
      const sup = findUserByName(db, supervisorName)
      if (!sup) {
        errors.push({ row: rowNo, message: `主管「${supervisorName}」不存在或已禁用` })
        return
      }
      supId = sup.id
    }

    // 责任人
    const assigneeIds = []
    const assigneeText = get('assignees')
    for (const nm of splitList(assigneeText)) {
      const u = findUserByName(db, nm)
      if (!u) {
        errors.push({ row: rowNo, message: `责任人「${nm}」不存在或已禁用` })
        return
      }
      if (!assigneeIds.includes(u.id)) assigneeIds.push(u.id)
    }

    // 日常管理必须有管理类别
    if (taskType === 'daily_management' && !managementCategory) {
      errors.push({ row: rowNo, message: '部门日常管理任务必须填写「管理类别」' })
      return
    }

    if (dryRun) {
      errors.push({ row: rowNo, message: '（校验通过，未写入）' })
      return
    }

    // 默认主管（与 POST /api/tasks 一致）：
    // 项目任务、部门重点工作与日常管理均为「谁发起谁负责」——默认主管 = 导入操作人（发起人）
    if (!supId) {
      if (['self_repair', 'rectification', 'quality_analysis', 'key_work', 'daily_management'].includes(taskType)) {
        supId = publisherId
      }
    }

    let fullDescription = description || ''
    if (taskType === 'daily_management' && managementCategory) {
      fullDescription = managementCategory === '其他' && managementDetail
        ? '[ 其他: ' + managementDetail + ' ]' + (fullDescription ? '\n' + fullDescription : '')
        : '[ ' + managementCategory + ' ]' + (fullDescription ? '\n' + fullDescription : '')
    }

    // 发起人负责制任务（项目任务 / 部门重点工作）创建后进入「分解中」，
    // 由发起人新增子任务并指派执行人；日常管理直接进入进行中。
    const isPublisherFlow = ['self_repair', 'rectification', 'quality_analysis', 'key_work'].includes(taskType)
    const initialStatus = taskType === 'daily_management'
      ? 'in_progress'
      : (isPublisherFlow ? 'decomposing' : 'pending')

    try {
      db.run(`
        INSERT INTO tasks (title, description, task_type, priority, status, publisher_id, supervisor_id, assignee_id, deadline, management_category, management_detail, wbs_project_ids, wbs_car_ids, import_batch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title, fullDescription, taskType, priority, initialStatus, publisherId, supId || null,
        assigneeIds[0] || null, deadline, managementCategory || '', managementDetail || '',
        wbsProjects.length ? JSON.stringify(wbsProjects.map(p => p.id)) : '',
        wbsCars.length ? JSON.stringify(wbsCars.map(c => c.id)) : '',
        importBatch
      ])

      const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
      createdIds.push(id)

      // 责任人统一记录在 task_assignees（部门重点工作与项目任务一致，
      // 实际执行人以后续新增的子任务指派为准）
      for (const uid of assigneeIds) {
        db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [id, uid])
      }

      db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "import", ?)',
        [id, publisherId, `通过 Excel 导入创建任务（批次 ${importBatch}）`])
    } catch (e) {
      errors.push({ row: rowNo, message: '写入失败：' + e.message })
    }
  })

  res.json({
    success: true,
    batch: importBatch,
    total: rows.length,
    created: createdIds.length,
    failed: errors.filter(e => !e.message.startsWith('（校验通过')).length,
    errors,
    taskIds: createdIds
  })
})

export default router
