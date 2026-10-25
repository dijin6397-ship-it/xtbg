import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission, hasPermission, PERMISSIONS } from '../permissions.js'

const router = Router()

// Helper: get user object by id
function getUserById(db, id) {
  const stmt = db.prepare('SELECT id, username, name, role, title, department FROM users WHERE id = ?')
  stmt.bind([id])
  const user = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return user
}

// ---------------------------------------------------------------------------
// WBS（项目号 / 车号）辅助函数
// 任务上的 wbs_project_ids / wbs_car_ids 以 JSON 数组文本保存（支持多选）。
// ---------------------------------------------------------------------------

function parseIdList(raw) {
  if (raw === null || raw === undefined || raw === '') return []
  if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isFinite(n) && n > 0)
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(Number).filter(n => Number.isFinite(n) && n > 0) : []
  } catch (e) {
    return String(raw).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0)
  }
}

function serializeIdList(list) {
  if (!Array.isArray(list)) return ''
  const clean = Array.from(new Set(list.map(Number).filter(n => Number.isFinite(n) && n > 0)))
  return clean.length > 0 ? JSON.stringify(clean) : ''
}

// 根据 id 列表取出 WBS 条目（含所属项目信息）
function resolveWbsItems(db, ids) {
  if (!ids || ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT id, level, parent_id, code, name FROM wbs_items WHERE id IN (${placeholders})`)
  stmt.bind(ids)
  const map = {}
  while (stmt.step()) {
    const r = stmt.getAsObject()
    map[r.id] = { id: r.id, level: r.level, parentId: r.parent_id, code: r.code || '', name: r.name }
  }
  stmt.free()
  // 保持传入顺序
  return ids.map(id => map[id]).filter(Boolean)
}

// 把任务行上的 WBS 字段解析成对外的 { wbsProjects, wbsCars }
function attachWbs(db, task) {
  const projectIds = parseIdList(task.wbs_project_ids)
  const carIds = parseIdList(task.wbs_car_ids)
  const projects = resolveWbsItems(db, projectIds)
  const cars = resolveWbsItems(db, carIds)

  // 车号带上所属项目名，便于列表/详情直接展示
  const carProjectIds = Array.from(new Set(cars.map(c => c.parentId).filter(Boolean)))
  const carProjects = resolveWbsItems(db, carProjectIds)
  const carProjectMap = {}
  for (const p of carProjects) carProjectMap[p.id] = p

  task.wbsProjects = projects
  task.wbsCars = cars.map(c => ({ ...c, projectName: carProjectMap[c.parentId]?.name || '' }))
  task.wbsProjectNames = projects.map(p => p.name)
  task.wbsCarNames = cars.map(c => c.name)
  return task
}

// 按 code 或 name 解析项目WBS / 车号（导入时使用，容错）
function resolveWbsByText(db, text, level, parentId) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = raw.split(/[、,，;；\/\|\s]+/).map(s => s.trim()).filter(Boolean)
  const out = []
  for (const part of parts) {
    let sql = 'SELECT id, code, name FROM wbs_items WHERE level = ? AND active = 1 AND (code = ? OR name = ?)'
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
// 任务编辑窗口：子任务填写完成后、截止日期之前，任务发起人可以继续修改任务
// （新增/修改子任务、修改完成时间等）。
// ---------------------------------------------------------------------------

function isPastDeadline(task) {
  if (!task?.deadline) return false
  const dl = new Date(String(task.deadline).slice(0, 10) + 'T23:59:59')
  if (isNaN(dl.getTime())) return false
  return Date.now() > dl.getTime()
}

// 返回 { allowed: boolean, error?: string }
// 规则（需求：A 发起的任务只能 A 修改）：任务编辑权仅属于【任务发起人】，
// 在「子任务填写完成后、截止日期之前」的窗口内可继续修改；
// 其他任何人（含主管/领导）一律不可编辑。管理员(admin)作为系统兜底保留编辑能力。
function checkPublisherEditWindow(task, user) {
  if (!task) return { allowed: false, error: '任务不存在' }
  const isPublisher = Number(task.publisher_id) === Number(user.id)
  if (isPublisher) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      return { allowed: false, error: '任务已完成或已撤回，发起人不能再修改' }
    }
    if (isPastDeadline(task)) {
      return { allowed: false, error: '已超过任务截止日期，发起人不能再修改' }
    }
    return { allowed: true }
  }
  if (user.role === 'admin') return { allowed: true }
  return { allowed: false, error: '权限不足：仅任务发起人可修改该任务' }
}

// ============================================================
// 任务流程分组
// ============================================================
// 发起人负责制任务（谁发起谁分配子任务、谁发起谁审核、谁发起谁确认完成）：
//   - 项目任务：自主修 / 问题整改 / 现场质量问题分析（主管、领导可发布）
//   - 部门重点工作（仅领导可发布，另有领导督办）
// 部门日常管理不涉及子任务分配，也不需要分解流程。
// ============================================================
const PUBLISHER_FLOW_TASK_TYPES = ['self_repair', 'rectification', 'quality_analysis', 'key_work']

function isPublisherFlowTask(taskType) {
  return PUBLISHER_FLOW_TASK_TYPES.includes(taskType)
}

// ============================================================
// 子任务分配/编辑权限（比任务编辑更严格）
// 发起人负责制任务（项目任务 / 部门重点工作）遵循「谁发起谁分配子任务」：
//   仅发起人本人或管理员可增删改子任务，其他主管/领导不得干预。
// 部门日常管理：不涉及子任务分配，任何人不得新增子任务。
// 其他任务类型沿用 checkPublisherEditWindow（管理员/主管/领导亦可）。
// ============================================================
function checkSubtaskAssignPermission(task, user) {
  if (!task) return { allowed: false, error: '任务不存在' }

  // 部门日常管理按类别执行，不需要（也不允许）新增子任务分配
  if (task.task_type === 'daily_management') {
    return { allowed: false, error: '部门日常管理任务无需分配子任务' }
  }

  const isPublisher = Number(task.publisher_id) === Number(user.id)
  const isAdmin = user.role === 'admin'

  if (isPublisherFlowTask(task.task_type)) {
    if (!isPublisher && !isAdmin) {
      return { allowed: false, error: '权限不足：项目任务/部门重点工作由发起人分配子任务' }
    }
    if (task.status === 'completed' || task.status === 'cancelled') {
      return { allowed: false, error: '任务已完成或已撤回，不能再调整子任务' }
    }
    // 发起人本人（或管理员）在截止日期前可继续调整
    if (isPublisher && !isAdmin && isPastDeadline(task)) {
      return { allowed: false, error: '已超过任务截止日期，不能再调整子任务' }
    }
    return { allowed: true }
  }

  return checkPublisherEditWindow(task, user)
}

// 记录任务修改留痕
function logTaskChange(db, taskId, userId, changeType, detail) {
  try {
    db.run(
      'INSERT INTO task_change_logs (task_id, operator_id, change_type, detail) VALUES (?, ?, ?, ?)',
      [taskId, userId, changeType || 'task', detail || '']
    )
  } catch (e) { /* noop */ }
}

// Helper: get full task with relations
function getFullTask(db, taskId) {
  const tStmt = db.prepare('SELECT * FROM tasks WHERE id = ?')
  tStmt.bind([taskId])
  const task = tStmt.step() ? tStmt.getAsObject() : null
  tStmt.free()
  if (!task) return null

  task.publisher = getUserById(db, task.publisher_id)
  task.supervisor = getUserById(db, task.supervisor_id)
  if (task.assignee_id) {
    task.direct_assignee = getUserById(db, task.assignee_id)
  }

  attachWbs(db, task)

  const aStmt = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.title, u.department 
    FROM task_assignees ta JOIN users u ON ta.user_id = u.id 
    WHERE ta.task_id = ?
  `)
  aStmt.bind([taskId])
  task.assignees = []
  while (aStmt.step()) task.assignees.push(aStmt.getAsObject())
  aStmt.free()

  const sStmt = db.prepare(`
    SELECT s.*, u.id as uid, u.name as uname, u.role as urole, u.title as utitle
    FROM subtasks s LEFT JOIN users u ON s.assignee_id = u.id
    WHERE s.task_id = ? ORDER BY s.id
  `)
  sStmt.bind([taskId])
  task.subtasks = []
  while (sStmt.step()) {
    const row = sStmt.getAsObject()
    task.subtasks.push({
      id: row.id,
      title: row.title,
      status: row.status,
      progress: row.progress,
      deadline: row.deadline || null,
      assignee: row.uid ? { id: row.uid, name: row.uname, role: row.urole, title: row.utitle } : null
    })
  }
  sStmt.free()

  // 「执行人」统一口径：任务的实际执行人 = 子任务执行人（谁领子任务谁执行）。
  // 任务信息卡片直接展示该列表，保证与子任务执行人完全一致（同一批人）。
  // 历史数据无子任务时，回退到任务级执行人（key_work 的 direct_assignee / assignees）。
  const subAssigneeMap = new Map()
  for (const s of task.subtasks) {
    if (s.assignee && s.assignee.id && !subAssigneeMap.has(Number(s.assignee.id))) {
      subAssigneeMap.set(Number(s.assignee.id), s.assignee)
    }
  }
  task.executor_list = Array.from(subAssigneeMap.values())
  task.executor_names = task.executor_list.map(u => u.name)

  const oStmt = db.prepare(`
    SELECT o.*, u.name as reviewer_name
    FROM task_outputs o LEFT JOIN users u ON o.reviewer_id = u.id
    WHERE o.task_id = ? ORDER BY o.id DESC
  `)
  oStmt.bind([taskId])
  task.outputs = []
  // Pre-fetch any category names + reference scores referenced by outputs
  const catIds = []
  while (oStmt.step()) {
    const row = oStmt.getAsObject()
    if (row.category_l1) catIds.push(row.category_l1)
    if (row.category_l2) catIds.push(row.category_l2)
    if (row.category_l3) catIds.push(row.category_l3)
  }
  oStmt.free()
  const catMap = {}
  if (catIds.length > 0) {
    const uniq = Array.from(new Set(catIds))
    const placeholders = uniq.map(() => '?').join(',')
    const cStmt = db.prepare(`SELECT id, name, level, score_rule, score_value, score_upper FROM dict_categories WHERE id IN (${placeholders})`)
    cStmt.bind(uniq)
    while (cStmt.step()) {
      const c = cStmt.getAsObject()
      catMap[c.id] = { name: c.name, level: c.level, score_rule: c.score_rule, score_value: c.score_value, score_upper: c.score_upper }
    }
    cStmt.free()
  }

  const oStmt2 = db.prepare(`
    SELECT o.*, u.name as reviewer_name
    FROM task_outputs o LEFT JOIN users u ON o.reviewer_id = u.id
    WHERE o.task_id = ? ORDER BY o.id DESC
  `)
  oStmt2.bind([taskId])
  while (oStmt2.step()) {
    const row = oStmt2.getAsObject()
    const submitter = getUserById(db, row.user_id)
    task.outputs.push({
      id: row.id,
      subtaskId: row.subtask_id || null,
      content: row.content,
      status: row.status,
      reviewComment: row.review_comment,
      reviewedAt: row.reviewed_at,
      submitter,
      reviewer: row.reviewer_name ? { id: row.reviewer_id, name: row.reviewer_name } : null,
      createdAt: row.created_at,
      categoryL1: row.category_l1 || null,
      categoryL2: row.category_l2 || null,
      categoryL3: row.category_l3 || null,
      categoryL1Name: row.category_l1 ? (catMap[row.category_l1]?.name || '') : '',
      categoryL2Name: row.category_l2 ? (catMap[row.category_l2]?.name || '') : '',
      categoryL3Name: row.category_l3 ? (catMap[row.category_l3]?.name || '') : '',
      scoreValue: row.score_value || 0,
      scoreQuantity: row.score_quantity || 0,
      scoreTotal: row.score_total || 0,
      scoreRule: row.score_rule || '',
      // Reference scores from the L3 dictionary entry (for display in review modal)
      refScoreValue: row.category_l3 ? (catMap[row.category_l3]?.score_value ?? 0) : 0,
      refScoreUpper: row.category_l3 ? (catMap[row.category_l3]?.score_upper ?? 0) : 0,
      // Whether the submitter self-scored
      submitScore: (row.score_value && row.score_value > 0) || false
    })
  }
  oStmt2.free()

  const fStmt = db.prepare('SELECT f.*, u.name FROM feedbacks f JOIN users u ON f.user_id = u.id WHERE f.task_id = ? ORDER BY f.id')
  fStmt.bind([taskId])
  task.feedbacks = []
  while (fStmt.step()) {
    const row = fStmt.getAsObject()
    task.feedbacks.push({
      id: row.id,
      type: row.type,
      content: row.content,
      user: { id: row.user_id, name: row.name },
      time: row.created_at
    })
  }
  fStmt.free()

  task.milestones = []
  task.tags = []

  return task
}

// Helper: update task progress based on completed subtask count
function recalcProgress(db, taskId) {
  const stmt = db.prepare('SELECT status FROM subtasks WHERE task_id = ?')
  stmt.bind([taskId])
  const statuses = []
  while (stmt.step()) {
    statuses.push(stmt.getAsObject().status)
  }
  stmt.free()

  let progress = 0
  if (statuses.length > 0) {
    const completed = statuses.filter(s => s === 'completed').length
    progress = Math.round((completed / statuses.length) * 100)
  }
  db.run('UPDATE tasks SET progress = ?, updated_at = datetime("now","localtime") WHERE id = ?', [progress, taskId])
  return progress
}

const taskTypeLabels = {
  self_repair: '自主修',
  rectification: '问题整改',
  quality_analysis: '现场质量问题分析',
  key_work: '部门重点工作',
  daily_management: '部门日常管理'
}

// 按关键字解析 WBS 条目 id（项目WBS = level 1，车号 = level 2）
// 支持按 code 或 name 模糊匹配，例如 "N-A228" / "0289"
function resolveWbsIdsByKeyword(db, keyword, level) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  const stmt = db.prepare(
    'SELECT id FROM wbs_items WHERE level = ? AND active = 1 AND (code LIKE ? OR name LIKE ?)'
  )
  stmt.bind([level, `%${kw}%`, `%${kw}%`])
  const ids = []
  while (stmt.step()) ids.push(stmt.getAsObject().id)
  stmt.free()
  return ids
}

// 生成「JSON 数组包含指定 id」的 SQL 片段。
// wbs_project_ids / wbs_car_ids 存的是 JSON 数字数组文本，如 "[17]"、"[17,18]"。
// 不能直接用 LIKE '%17%'（会误匹配 117/170/1717），必须按数组位置精确匹配：
//   单个元素      [17]        -> col = '[17]'
//   首元素        [17,18]     -> col LIKE '[17,%'
//   中间元素      [16,17,18]  -> col LIKE '%,17,%'
//   末元素        [16,17]     -> col LIKE '%,17]'
function jsonArrayContainsSql(column, ids) {
  if (!ids || ids.length === 0) return null
  const clauses = []
  const params = []
  for (const id of ids) {
    clauses.push(`(${column} = ? OR ${column} LIKE ? OR ${column} LIKE ? OR ${column} LIKE ?)`)
    params.push(
      JSON.stringify([id]),      // [17]
      '[' + id + ',%',           // [17,18  （首元素）
      '%,' + id + ',%',          // ,17,   （中间元素）
      '%,' + id + ']'            // ,17]   （末元素）
    )
  }
  return { sql: '(' + clauses.join(' OR ') + ')', params }
}

// GET /api/tasks - List tasks with filters
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const { status, priority, task_type, search, my_tasks, publisher_id, publisher, wbs_project, wbs_car } = req.query

  let sql = 'SELECT t.* FROM tasks t WHERE 1=1'
  const params = []

  if (status) { sql += ' AND t.status = ?'; params.push(status) }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority) }
  if (task_type) { sql += ' AND t.task_type = ?'; params.push(task_type) }
  if (search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  // 发起人筛选：支持按 user id 精确匹配，也支持按姓名模糊匹配
  if (publisher_id) {
    sql += ' AND t.publisher_id = ?'
    params.push(Number(publisher_id))
  } else if (publisher) {
    sql += ' AND t.publisher_id IN (SELECT id FROM users WHERE name LIKE ? OR username LIKE ?)'
    params.push(`%${publisher}%`, `%${publisher}%`)
  }

  // 项目号（WBS元素）筛选：先按关键字解析出 WBS id，再匹配任务上的 JSON 数组
  if (wbs_project) {
    const ids = resolveWbsIdsByKeyword(db, wbs_project, 1)
    if (ids.length === 0) {
      return res.json({ tasks: [] })
    }
    const m = jsonArrayContainsSql('t.wbs_project_ids', ids)
    sql += ' AND ' + m.sql
    params.push(...m.params)
  }

  // 车号筛选：同上，level 2
  if (wbs_car) {
    const ids = resolveWbsIdsByKeyword(db, wbs_car, 2)
    if (ids.length === 0) {
      return res.json({ tasks: [] })
    }
    const m = jsonArrayContainsSql('t.wbs_car_ids', ids)
    sql += ' AND ' + m.sql
    params.push(...m.params)
  }

  if (my_tasks === 'true') {
    const uid = req.user.id
    sql += ` AND (
      t.publisher_id = ? OR t.supervisor_id = ? OR 
      t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?) OR
      t.id IN (SELECT task_id FROM subtasks WHERE assignee_id = ?)
    )`
    params.push(uid, uid, uid, uid)
  }

  sql += ' ORDER BY t.created_at DESC'
  const stmt = db.prepare(sql)
  stmt.bind(params)
  
  const taskIds = []
  while (stmt.step()) {
    taskIds.push(stmt.getAsObject().id)
  }
  stmt.free()

  const tasks = taskIds.map(id => getFullTask(db, id)).filter(Boolean)
  res.json({ tasks })
})

// GET /api/tasks/:id - Get single task
router.get('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()
  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })
  res.json({ task })
})

// POST /api/tasks - Create task
router.post('/', authMiddleware, (req, res) => {
  const { title, description, task_type, priority, deadline, supervisor_id, assignee_ids, assignee_id, management_category, management_detail, wbs_project_ids, wbs_car_ids } = req.body

  if (!task_type) {
    return res.status(400).json({ error: '请选择任务类型' })
  }

  // Role-based validation for task creation
  const userRole = req.user.role
  if (task_type === 'self_repair' || task_type === 'rectification' || task_type === 'quality_analysis') {
    // 项目任务：仅「主管(supervisor)」「领导(leader)」「管理员(admin)」可发起
    // 说明：技术主管与质量主管已合并为统一的「主管」角色
    const allowedRoles = ['leader', 'supervisor', 'admin']
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: '权限不足：项目任务只能由主管、领导或管理员发起' })
    }
  } else if (task_type === 'key_work') {
    // Key work: only leader, admin
    const allowedRoles = ['leader', 'admin']
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: '权限不足：部门重点工作只能由领导或管理员发起' })
    }
  } else if (task_type === 'daily_management') {
    // Daily management: all roles allowed
    // No restriction needed - all authenticated users can create
  }

  // Deadline is required for all task types
  if (!deadline) {
    return res.status(400).json({ error: '截止日期为必填项' })
  }

  const db = getDB()
  const publisherId = req.user.id

  // ============================================================
  // 「谁发起谁分配子任务、谁发起谁审核」：
  // 项目任务（自主修/问题整改/现场质量问题分析）与部门重点工作的 supervisor 统一设为发起人本人，
  // 不再自动指向固定主管。这样发起人即可分配子任务并审核输出物。
  // 部门日常管理同样沿用「谁发起谁负责」。
  // ============================================================
  let supId = supervisor_id
  if (!supId) {
    if (['self_repair', 'rectification', 'quality_analysis', 'key_work', 'daily_management'].includes(task_type)) {
      supId = publisherId
    }
  }

  const taskTitle = title && title.trim() 
    ? title.trim() 
    : `${taskTypeLabels[task_type] || task_type}任务`

  let initialStatus = 'pending'
  if (task_type === 'daily_management') {
    // daily_management 任务无需分解/分配流程，创建后直接进入进行中
    initialStatus = 'in_progress'
  } else if (isPublisherFlowTask(task_type)) {
    // 项目任务、部门重点工作：由发起人自行分配子任务，创建后进入「分解中」，
    // 发起人随后在任务详情/分解页添加子任务与责任人，再点击「完成分配，开始执行」
    initialStatus = 'decomposing'
  }

  let fullDescription = description || ''
  if (task_type === 'daily_management' && management_category) {
    if (management_category === '其他' && management_detail) {
      fullDescription = '[ ' + management_category + ': ' + management_detail + ' ]' + (fullDescription ? '\n' + fullDescription : '')
    } else {
      fullDescription = '[ ' + management_category + ' ]' + (fullDescription ? '\n' + fullDescription : '')
    }
  }

  db.run(`
    INSERT INTO tasks (title, description, task_type, priority, status, publisher_id, supervisor_id, assignee_id, deadline, management_category, management_detail, wbs_project_ids, wbs_car_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [taskTitle, fullDescription, task_type, priority || 'normal', initialStatus, publisherId, supId || null, assignee_id || null, deadline || null, management_category || '', management_detail || '', serializeIdList(wbs_project_ids), serializeIdList(wbs_car_ids)])

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]

  if (task_type === 'key_work' && assignee_id) {
    db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [id, assignee_id])
  } else if (assignee_ids && Array.isArray(assignee_ids)) {
    for (const uid of assignee_ids) {
      db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [id, uid])
    }
  }

  const task = getFullTask(db, id)
  res.status(201).json({ task })
})

// PUT /api/tasks/:id - Update task
// 权限：管理员/主管/领导，或【任务发起人】在「子任务填写完成后、截止日期之前」的窗口内。
router.put('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  const gate = checkPublisherEditWindow(task, req.user)
  if (!gate.allowed) {
    return res.status(403).json({ error: gate.error })
  }

  const { title, description, priority, deadline, status, supervisor_id, task_type, assignee_id, management_category, management_detail, wbs_project_ids, wbs_car_ids } = req.body

  // 发起人自主编辑时，不允许通过该接口改动流程关键字段（状态/主管/类型），
  // 避免绕过既有流程；这些字段仅管理员/主管/领导可改。
  const isPublisherOnly = Number(task.publisher_id) === Number(req.user.id) &&
    !['admin', 'leader', 'supervisor'].includes(req.user.role)

  const updates = []
  const params = []
  const changes = []

  if (title !== undefined) {
    updates.push('title = ?'); params.push(title)
    if (title !== task.title) changes.push(`标题: ${task.title} → ${title}`)
  }
  if (description !== undefined) {
    updates.push('description = ?'); params.push(description)
    if (description !== task.description) changes.push('任务描述已更新')
  }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority) }
  if (deadline !== undefined) {
    updates.push('deadline = ?'); params.push(deadline)
    if ((deadline || '') !== (task.deadline || '')) changes.push(`完成时间(截止日期): ${task.deadline || '未设置'} → ${deadline || '未设置'}`)
  }
  if (!isPublisherOnly) {
    if (status !== undefined) { updates.push('status = ?'); params.push(status) }
    if (supervisor_id !== undefined) { updates.push('supervisor_id = ?'); params.push(supervisor_id) }
    if (task_type !== undefined) { updates.push('task_type = ?'); params.push(task_type) }
  }
  if (management_category !== undefined) { updates.push('management_category = ?'); params.push(management_category) }
  if (management_detail !== undefined) { updates.push('management_detail = ?'); params.push(management_detail) }
  if (wbs_project_ids !== undefined) {
    updates.push('wbs_project_ids = ?'); params.push(serializeIdList(wbs_project_ids))
    changes.push('项目号(WBS)已更新')
  }
  if (wbs_car_ids !== undefined) {
    updates.push('wbs_car_ids = ?'); params.push(serializeIdList(wbs_car_ids))
    changes.push('车号已更新')
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime("now","localtime")')
    params.push(id)
    db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params)
  }

  // Update assignee if provided
  if (assignee_id !== undefined) {
    db.run('DELETE FROM task_assignees WHERE task_id = ?', [id])
    if (assignee_id) {
      db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [id, assignee_id])
    }
  }

  if (changes.length > 0) {
    logTaskChange(db, id, req.user.id, 'task', changes.join('；'))
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "edit", ?)',
      [id, req.user.id, '修改任务: ' + changes.join('；')])
  }

  const updated = getFullTask(db, id)
  res.json({ task: updated })
})

// GET /api/tasks/:id/edit-permission - 当前用户能否修改该任务（用于前端按钮显隐）
router.get('/:id/edit-permission', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()
  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })
  const gate = checkPublisherEditWindow(task, req.user)
  // 子任务编辑权限单独判定：部门日常管理不允许分配子任务，
  // 项目任务/部门重点工作仅发起人（或管理员）可分配
  const subGate = checkSubtaskAssignPermission(task, req.user)
  res.json({
    allowed: gate.allowed,
    error: gate.error || '',
    isPublisher: Number(task.publisher_id) === Number(req.user.id),
    isPastDeadline: isPastDeadline(task),
    canEditSubtasks: subGate.allowed,
    subtaskError: subGate.error || '',
    supportsSubtasks: task.task_type !== 'daily_management'
  })
})

// POST /api/tasks/:id/assign - Assign task to users
router.post('/:id/assign', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { assignee_ids, subtasks } = req.body
  const db = getDB()

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  // 部门日常管理不涉及子任务分配
  if (task.task_type === 'daily_management') {
    return res.status(403).json({ error: '部门日常管理任务无需分配子任务' })
  }

  // 含子任务的分配同样走子任务权限校验（项目任务/部门重点工作仅发起人可分配）
  if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
    const gate = checkSubtaskAssignPermission(task, req.user)
    if (!gate.allowed) {
      return res.status(403).json({ error: gate.error })
    }
  }

  if (assignee_ids && Array.isArray(assignee_ids)) {
    for (const uid of assignee_ids) {
      db.run('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)', [id, uid])
    }
  }

  if (subtasks && Array.isArray(subtasks)) {
    for (const st of subtasks) {
      db.run('INSERT INTO subtasks (task_id, title, assignee_id) VALUES (?, ?, ?)', [id, st.title, st.assignee_id])
    }
  }

  if (task.status === 'pending') {
    db.run('UPDATE tasks SET status = "in_progress", updated_at = datetime("now","localtime") WHERE id = ?', [id])
  }

  const updated = getFullTask(db, id)
  res.json({ task: updated })
})

// POST /api/tasks/:id/subtasks - Add subtasks
// 允许：管理员/主管/领导，或【任务发起人】在截止日期之前（子任务填写完成后仍可继续新增子任务）
router.post('/:id/subtasks', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { subtasks } = req.body
  const db = getDB()

  if (!subtasks || !Array.isArray(subtasks)) {
    return res.status(400).json({ error: '请提供子任务列表' })
  }

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  const gate = checkSubtaskAssignPermission(task, req.user)
  if (!gate.allowed) {
    return res.status(403).json({ error: gate.error })
  }

  const added = []
  for (const st of subtasks) {
    if (!st || !st.title) continue
    db.run('INSERT INTO subtasks (task_id, title, assignee_id, deadline) VALUES (?, ?, ?, ?)',
      [id, st.title, st.assignee_id || null, st.deadline || ''])
    added.push(st.title)
  }

  db.run('UPDATE tasks SET status = "in_progress", updated_at = datetime("now","localtime") WHERE id = ? AND status = "pending"', [id])

  if (added.length > 0) {
    logTaskChange(db, id, req.user.id, 'subtask', '新增子任务: ' + added.join('、'))
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "edit", ?)',
      [id, req.user.id, '新增子任务: ' + added.join('、')])
  }

  const updated = getFullTask(db, id)
  res.json({ task: updated })
})

// PUT /api/tasks/:id/subtasks/:subId - Update subtask
// 允许：管理员/主管/领导，或【任务发起人】在截止日期之前修改子任务标题/执行人/完成时间/进度
router.put('/:id/subtasks/:subId', authMiddleware, (req, res) => {
  const taskId = Number(req.params.id)
  const subId = Number(req.params.subId)
  const { status, progress, title, assignee_id, deadline } = req.body
  const db = getDB()

  const task = getFullTask(db, taskId)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  const sub = (task.subtasks || []).find(s => Number(s.id) === subId)
  if (!sub) return res.status(404).json({ error: '子任务不存在' })

  const gate = checkSubtaskAssignPermission(task, req.user)
  if (!gate.allowed) {
    return res.status(403).json({ error: gate.error })
  }

  const isPublisherOnly = Number(task.publisher_id) === Number(req.user.id) &&
    !['admin', 'leader', 'supervisor'].includes(req.user.role)

  const updates = []
  const params = []
  const changes = []
  if (status !== undefined && !isPublisherOnly) { updates.push('status = ?'); params.push(status) }
  if (progress !== undefined && !isPublisherOnly) { updates.push('progress = ?'); params.push(progress) }
  if (title !== undefined) {
    updates.push('title = ?'); params.push(title)
    if (title !== sub.title) changes.push(`子任务标题: ${sub.title} → ${title}`)
  }
  if (assignee_id !== undefined) {
    updates.push('assignee_id = ?'); params.push(assignee_id || null)
    changes.push('子任务执行人已调整')
  }
  if (deadline !== undefined) {
    updates.push('deadline = ?'); params.push(deadline || '')
    if ((deadline || '') !== (sub.deadline || '')) changes.push(`子任务完成时间: ${sub.deadline || '未设置'} → ${deadline || '未设置'}`)
  }

  if (updates.length > 0) {
    params.push(subId, taskId)
    db.run(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ? AND task_id = ?`, params)
  }

  if (changes.length > 0) {
    logTaskChange(db, taskId, req.user.id, 'subtask', `[${sub.title}] ` + changes.join('；'))
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "edit", ?)',
      [taskId, req.user.id, `修改子任务[${sub.title}]: ` + changes.join('；')])
  }

  recalcProgress(db, taskId)
  const updated = getFullTask(db, taskId)
  res.json({ task: updated })
})

// DELETE /api/tasks/:id/subtasks/:subId - 删除子任务（发起人窗口内 / 管理员/主管/领导）
router.delete('/:id/subtasks/:subId', authMiddleware, (req, res) => {
  const taskId = Number(req.params.id)
  const subId = Number(req.params.subId)
  const db = getDB()

  const task = getFullTask(db, taskId)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  const sub = (task.subtasks || []).find(s => Number(s.id) === subId)
  if (!sub) return res.status(404).json({ error: '子任务不存在' })

  const gate = checkSubtaskAssignPermission(task, req.user)
  if (!gate.allowed) {
    return res.status(403).json({ error: gate.error })
  }

  db.run('DELETE FROM subtasks WHERE id = ? AND task_id = ?', [subId, taskId])
  logTaskChange(db, taskId, req.user.id, 'subtask', `删除子任务: ${sub.title}`)
  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "edit", ?)',
    [taskId, req.user.id, `删除子任务: ${sub.title}`])

  recalcProgress(db, taskId)
  const updated = getFullTask(db, taskId)
  res.json({ task: updated })
})

// POST /api/tasks/:id/feedback - Add feedback/comment
router.post('/:id/feedback', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { type, content } = req.body
  const db = getDB()

  if (!content) return res.status(400).json({ error: '请输入反馈内容' })

  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, ?, ?)',
    [id, req.user.id, type || 'progress', content])

  db.run('UPDATE tasks SET updated_at = datetime("now","localtime") WHERE id = ?', [id])

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/submit-output - Staff submits output (with self-scoring)
router.post('/:id/submit-output', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { content, subtask_id, category_l1, category_l2, category_l3, score_value, score_quantity } = req.body
  const userId = req.user.id
  const db = getDB()

  if (!content) return res.status(400).json({ error: '请填写输出物' })
  if (!category_l1) return res.status(400).json({ error: '请选择一级分类' })
  if (!category_l2) return res.status(400).json({ error: '请选择二级分类' })
  if (!category_l3) return res.status(400).json({ error: '请选择三级分类' })

  // 提交人资格校验（需求：项目任务发布后，子任务执行人必须能提交输出物；
  // 同时防止无关人员提交）：
  // - 部门日常管理：发起人本人提交；
  // - 其他类型：任务发起人、子任务执行人、任务级执行人（key_work 等）可提交；
  //   管理员兜底。
  const roleCheck = db.prepare('SELECT task_type, publisher_id FROM tasks WHERE id = ?')
  roleCheck.bind([id])
  const roleRow = roleCheck.step() ? roleCheck.getAsObject() : null
  roleCheck.free()
  if (!roleRow) return res.status(404).json({ error: '任务不存在' })

  if (roleRow.task_type !== 'daily_management') {
    const isPublisher = Number(roleRow.publisher_id) === Number(userId)
    const isAdmin = req.user.role === 'admin'
    let isExecutor = false
    const subStmt2 = db.prepare('SELECT COUNT(*) AS c FROM subtasks WHERE task_id = ? AND assignee_id = ?')
    subStmt2.bind([id, userId])
    const subRow2 = subStmt2.step() ? subStmt2.getAsObject() : null
    subStmt2.free()
    if (subRow2 && subRow2.c > 0) isExecutor = true
    if (!isExecutor) {
      const asStmt = db.prepare('SELECT COUNT(*) AS c FROM task_assignees WHERE task_id = ? AND user_id = ?')
      asStmt.bind([id, userId])
      const asRow = asStmt.step() ? asStmt.getAsObject() : null
      asStmt.free()
      if (asRow && asRow.c > 0) isExecutor = true
    }
    if (!isPublisher && !isExecutor && !isAdmin) {
      return res.status(403).json({ error: '权限不足：仅子任务执行人（或任务发起人）可提交输出物' })
    }
  }

  // Resolve rule + reference score from the chosen L3 entry
  const ruleStmt = db.prepare('SELECT score_rule, score_value, score_upper FROM dict_categories WHERE id = ?')
  ruleStmt.bind([category_l3])
  const rule = ruleStmt.step() ? ruleStmt.getAsObject() : null
  ruleStmt.free()
  if (!rule) return res.status(400).json({ error: '所选三级分类无效' })

  // Validate self-score if provided.
  // 注意：提交人填写的分值/数量只作为「提交人填报值」保存，输出物仍保持 pending，
  // 主管审核时会看到该值并在此基础上修改确认（不再自动标记为已通过）。
  let sVal = Number(score_value || 0)
  let sQty = Number(score_quantity || 0)
  let sTotal = 0
  const outputStatus = 'pending'
  const selfScored = !!(score_value !== undefined && score_value !== null && sVal > 0)

  if (selfScored) {
    // Submitter provided a self-score (proposal only, still needs supervisor review)
    if (!sQty || sQty <= 0) {
      return res.status(400).json({ error: '请填写数量（>0）' })
    }
    // Validate score against rule
    if (rule.score_rule === 'fixed') {
      if (sVal > Number(rule.score_value || 0)) {
        return res.status(400).json({ error: `该分类为固定分值 ${rule.score_value}，分数不得超过此值` })
      }
    } else if (rule.score_rule === 'range') {
      const lo = Number(rule.score_value || 0)
      const hi = Number(rule.score_upper || 0)
      if (sVal < lo || sVal > hi) {
        return res.status(400).json({ error: `该分类分值范围为 ${lo}-${hi}，请填写区间内的分数` })
      }
    }
    sTotal = Math.round(sVal * sQty * 100) / 100
  }

  // Use explicit subtask_id if provided, otherwise auto-associate
  let resolvedSubtaskId = subtask_id || null
  if (!resolvedSubtaskId) {
    const subStmt = db.prepare('SELECT id FROM subtasks WHERE task_id = ? AND assignee_id = ? AND status != "completed" ORDER BY id LIMIT 1')
    subStmt.bind([id, userId])
    const subtask = subStmt.step() ? subStmt.getAsObject() : null
    subStmt.free()
    resolvedSubtaskId = subtask?.id || null
  }

  // Insert output with self-score data (if provided). reviewer_id 留空，等待主管审核。
  db.run(`
    INSERT INTO task_outputs (task_id, subtask_id, user_id, content, category_l1, category_l2, category_l3, score_rule, status, score_value, score_quantity, score_total, reviewer_id, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `, [id, resolvedSubtaskId, userId, content, category_l1, category_l2, category_l3, rule.score_rule || 'fixed', outputStatus, sVal, sQty, sTotal, null])

  const submitLabel = selfScored
    ? `提交输出物（自评 ${sVal} × ${sQty} = ${sTotal}，待主管审核）: ${content}`
    : `提交输出物: ${content}`
  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "output", ?)',
    [id, userId, submitLabel])

  // Check task info
  const taskRow = db.prepare('SELECT task_type, status, publisher_id FROM tasks WHERE id = ?')
  taskRow.bind([id])
  const tInfo = taskRow.step() ? taskRow.getAsObject() : null
  taskRow.free()

  if (tInfo && tInfo.task_type === 'daily_management' && tInfo.status !== 'review') {
    // Daily management: do NOT auto-complete. Keep task in_progress.
    // The submitter must manually click "complete" after self-reviewing all outputs.
    // (Previously this auto-completed for staff/supervisor roles — removed per requirement.)
  } else if (tInfo && tInfo.status === 'overdue') {
    // 逾期任务：提交输出物后进入待验收，由领导/管理员复核
    db.run('UPDATE tasks SET status = "review", updated_at = datetime("now","localtime") WHERE id = ?', [id])
  }
  // 说明：项目任务与部门重点工作均为「谁发起谁审核」，提交输出物后保持进行中，
  // 由发起人在任务详情中审核评分；子任务全部完成并通过审核后任务自动完成。

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/review-output - 审核输出物
// 规则：发起人负责制任务（项目任务：自主修/问题整改/现场质量问题分析；部门重点工作）
//       由「发起人本人」审核评分（谁发起谁审核）；部门日常管理同样由发起人审核。
router.post('/:id/review-output', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { output_id, approved, comment, score_value, score_quantity } = req.body
  const db = getDB()

  if (!output_id) return res.status(400).json({ error: '缺少输出物ID' })

  // 审核权限校验
  const taskRow = db.prepare('SELECT task_type, publisher_id, supervisor_id FROM tasks WHERE id = ?')
  taskRow.bind([id])
  const tInfo = taskRow.step() ? taskRow.getAsObject() : null
  taskRow.free()
  if (!tInfo) return res.status(404).json({ error: '任务不存在' })

  const uid = req.user.id
  const role = req.user.role
  const isPublisherFlow = isPublisherFlowTask(tInfo.task_type)
  const isDaily = tInfo.task_type === 'daily_management'
  const isPublisher = Number(tInfo.publisher_id) === Number(uid)

  let canReview = false
  if (role === 'admin') {
    canReview = true
  } else if (isPublisherFlow || isDaily) {
    // 谁发起谁审核：发起人本人即可审核该任务下所有输出物
    // （部门重点工作由领导发起，即由该领导审核评分，与项目任务一致）
    canReview = isPublisher
  } else {
    // 其他类型：领导或本任务主管审核
    canReview = role === 'leader' || Number(tInfo.supervisor_id) === Number(uid)
  }

  // 兜底：仅「部门日常管理」允许提交人审核自己提交的输出物
  // （该类型任务由发起人本人提交并自评，若不放开会导致输出物无人可审、任务卡死）。
  // 项目任务/部门重点工作必须由发起人审核，提交人不得自审。
  if (!canReview && isDaily) {
    const ownPending = db.prepare('SELECT COUNT(*) AS c FROM task_outputs WHERE id = ? AND task_id = ? AND user_id = ?')
    ownPending.bind([output_id, id, uid])
    const ownRow = ownPending.step() ? ownPending.getAsObject() : null
    ownPending.free()
    if (ownRow && ownRow.c > 0) canReview = true
  }

  if (!canReview) {
    return res.status(403).json({ error: '权限不足：项目任务/部门重点工作由发起人审核' })
  }

  // Resolve the output and its reference rule
  const outStmt = db.prepare('SELECT category_l3 FROM task_outputs WHERE id = ? AND task_id = ?')
  outStmt.bind([output_id, id])
  const outRow = outStmt.step() ? outStmt.getAsObject() : null
  outStmt.free()
  if (!outRow) return res.status(404).json({ error: '输出物不存在' })
  if (!outRow.category_l3) return res.status(400).json({ error: '该输出物未选择三级分类' })

  const ruleStmt = db.prepare('SELECT score_rule, score_value, score_upper FROM dict_categories WHERE id = ?')
  ruleStmt.bind([outRow.category_l3])
  const rule = ruleStmt.step() ? ruleStmt.getAsObject() : { score_rule: 'fixed', score_value: 0, score_upper: 0 }
  ruleStmt.free()

  let sVal = Number(score_value || 0)
  let sQty = Number(score_quantity || 0)
  let sTotal = 0

  if (approved) {
    if (!sQty || sQty <= 0) {
      return res.status(400).json({ error: '请填写数量（>0）' })
    }
    // Validate score against rule
    if (rule.score_rule === 'fixed') {
      if (sVal <= 0) sVal = Number(rule.score_value || 0)
      if (sVal > Number(rule.score_value || 0)) {
        return res.status(400).json({ error: `该分类为固定分值 ${rule.score_value}，分数不得超过此值` })
      }
    } else if (rule.score_rule === 'range') {
      const lo = Number(rule.score_value || 0)
      const hi = Number(rule.score_upper || 0)
      if (sVal < lo || sVal > hi) {
        return res.status(400).json({ error: `该分类分值范围为 ${lo}-${hi}，请填写区间内的分数` })
      }
    } else if (rule.score_rule === 'any') {
      // No restriction
    }
    sTotal = Math.round(sVal * sQty * 100) / 100
  }

  const status = approved ? 'approved' : 'rejected'
  db.run(`
    UPDATE task_outputs SET status = ?, reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now','localtime'),
    score_value = ?, score_quantity = ?, score_total = ?, score_rule = ?
    WHERE id = ? AND task_id = ?
  `, [status, req.user.id, comment || '', sVal, sQty, sTotal, rule.score_rule, output_id, id])

  const label = approved ? '审核通过' : '审核不通过'
  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "review", ?)',
    [id, req.user.id, `${label}: ${comment || '无备注'}`])

  // If approved, mark the linked subtask as completed and recalculate progress
  if (approved) {
    // Find the subtask linked to this output
    const outStmt = db.prepare('SELECT subtask_id FROM task_outputs WHERE id = ? AND task_id = ?')
    outStmt.bind([output_id, id])
    const outRow = outStmt.step() ? outStmt.getAsObject() : null
    outStmt.free()

    if (outRow?.subtask_id) {
      db.run('UPDATE subtasks SET status = "completed", progress = 100 WHERE id = ? AND task_id = ?', [outRow.subtask_id, id])
      const newProgress = recalcProgress(db, id)
      // If all subtasks completed (100%)
      if (newProgress === 100) {
        // 发起人负责制任务（项目任务/部门重点工作）与日常管理：
        // 发起人审核通过后直接完成；逾期任务仍进入待验收由领导复核。
        const tCheck = db.prepare('SELECT task_type, status FROM tasks WHERE id = ?')
        tCheck.bind([id])
        const tRow = tCheck.step() ? tCheck.getAsObject() : null
        tCheck.free()
        if (tRow && tRow.status === 'overdue') {
          db.run('UPDATE tasks SET status = "review", progress = 100, updated_at = datetime("now","localtime") WHERE id = ?', [id])
        } else {
          db.run('UPDATE tasks SET status = "completed", progress = 100, completed_at = datetime("now","localtime"), updated_at = datetime("now","localtime") WHERE id = ?', [id])
        }
      }
    }
  }

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/approve-final - 最终确认完成 / 退回重做
// 权限：发起人负责制任务（项目任务/部门重点工作）与部门日常管理由发起人本人确认完成；
//       领导仍可对「待验收/逾期」状态任务复核；管理员兜底。
router.post('/:id/approve-final', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { approved, comment, output_scores } = req.body
  const db = getDB()

  const gateStmt = db.prepare('SELECT task_type, publisher_id, status FROM tasks WHERE id = ?')
  gateStmt.bind([id])
  const gateRow = gateStmt.step() ? gateStmt.getAsObject() : null
  gateStmt.free()
  if (!gateRow) return res.status(404).json({ error: '任务不存在' })

  const role = req.user.role
  const isPublisher = Number(gateRow.publisher_id) === Number(req.user.id)
  const isPublisherOrDaily = isPublisherFlowTask(gateRow.task_type) || gateRow.task_type === 'daily_management'
  const canFinal = role === 'admin' ||
    (role === 'leader' && (gateRow.status === 'review' || gateRow.status === 'overdue')) ||
    (isPublisher && isPublisherOrDaily)
  if (!canFinal) {
    return res.status(403).json({ error: '权限不足：仅发起人（项目任务/部门重点工作/日常管理）或领导（待验收/逾期）可执行最终审批' })
  }

  if (approved) {
    // 应用发起人修改后的分值（output_scores: [{ output_id, score_value, score_quantity }]）
    if (Array.isArray(output_scores) && output_scores.length > 0) {
      for (const item of output_scores) {
        if (!item.output_id) continue
        const sVal = Number(item.score_value || 0)
        const sQty = Number(item.score_quantity || 0)
        const sTotal = Math.round(sVal * sQty * 100) / 100
        // Validate against L3 category rule if applicable
        const outStmt = db.prepare('SELECT category_l3 FROM task_outputs WHERE id = ? AND task_id = ?')
        outStmt.bind([item.output_id, id])
        const outRow = outStmt.step() ? outStmt.getAsObject() : null
        outStmt.free()
        if (outRow?.category_l3) {
          const ruleStmt = db.prepare('SELECT score_rule, score_value, score_upper FROM dict_categories WHERE id = ?')
          ruleStmt.bind([outRow.category_l3])
          const rule = ruleStmt.step() ? ruleStmt.getAsObject() : null
          ruleStmt.free()
          if (rule) {
            if (rule.score_rule === 'fixed' && sVal > Number(rule.score_value || 0)) {
              return res.status(400).json({ error: `输出物 #${item.output_id} 分类固定分值 ${rule.score_value}，分数不得超过此值` })
            }
            if (rule.score_rule === 'range') {
              const lo = Number(rule.score_value || 0)
              const hi = Number(rule.score_upper || 0)
              if (sVal < lo || sVal > hi) {
                return res.status(400).json({ error: `输出物 #${item.output_id} 分类分值范围为 ${lo}-${hi}` })
              }
            }
          }
        }
        db.run('UPDATE task_outputs SET score_value = ?, score_quantity = ?, score_total = ? WHERE id = ? AND task_id = ?',
          [sVal, sQty, sTotal, item.output_id, id])
      }
    }
    db.run('UPDATE tasks SET status = "completed", progress = 100, completed_at = datetime("now","localtime"), updated_at = datetime("now","localtime") WHERE id = ?', [id])
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "approved", ?)',
      [id, req.user.id, `最终审核通过${comment ? ': ' + comment : ''}`])
  } else {
    db.run('UPDATE tasks SET status = "in_progress", updated_at = datetime("now","localtime") WHERE id = ?', [id])
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "rejected", ?)',
      [id, req.user.id, `最终审核不通过，退回重做${comment ? ': ' + comment : ''}`])
    db.run('UPDATE task_outputs SET status = "pending" WHERE task_id = ?', [id])
  }

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/complete - Submit for completion review
router.post('/:id/complete', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { note } = req.body
  const db = getDB()

  db.run('UPDATE tasks SET status = "review", updated_at = datetime("now","localtime") WHERE id = ?', [id])

  if (note) {
    db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "complete", ?)',
      [id, req.user.id, note])
  }

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/urge - Send urge
router.post('/:id/urge', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { type, content, target_id, subtask_id } = req.body
  const db = getDB()

  if (!content) return res.status(400).json({ error: '请输入催办内容' })

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  let targetId = target_id
  let urgeNote = content

  // If subtask_id is provided, find the subtask assignee
  if (subtask_id && !targetId) {
    const subStmt = db.prepare('SELECT s.assignee_id, s.title FROM subtasks s WHERE s.id = ? AND s.task_id = ?')
    subStmt.bind([subtask_id, id])
    const sub = subStmt.step() ? subStmt.getAsObject() : null
    subStmt.free()
    if (sub?.assignee_id) {
      targetId = sub.assignee_id
      urgeNote = '[' + sub.title + '] ' + content
    }
  }

  if (!targetId) {
    targetId = task.assignees[0]?.id || task.supervisor_id
  }

  db.run('INSERT INTO supervision_logs (task_id, type, operator_id, target_id, content) VALUES (?, ?, ?, ?, ?)',
    [id, type || 'urge', req.user.id, targetId, urgeNote])

  // Update deadline if new_deadline is provided
  if (req.body.new_deadline) {
    if (subtask_id) {
      db.run('UPDATE subtasks SET deadline = ? WHERE id = ? AND task_id = ?', [req.body.new_deadline, subtask_id, id])
    } else {
      db.run('UPDATE tasks SET deadline = ?, updated_at = datetime("now","localtime") WHERE id = ?', [req.body.new_deadline, id])
    }
  }

  // Create notification for the target user
  const notifTitle = subtask_id ? `子任务催办: ${task.title}` : `任务催办: ${task.title}`
  const notifContent = req.body.new_deadline
    ? `${urgeNote}
新的截止日期: ${req.body.new_deadline}`
    : urgeNote
  db.run(
    'INSERT INTO notifications (user_id, task_id, type, title, content, new_deadline) VALUES (?, ?, ?, ?, ?, ?)',
    [targetId, id, type || 'urge', notifTitle, notifContent, req.body.new_deadline || '']
  )

  res.json({ message: '催办已发送' })
})

// GET /api/stats - Dashboard stats
router.get('/stats/overview', authMiddleware, (req, res) => {
  const db = getDB()

  const total = db.exec('SELECT COUNT(*) FROM tasks')[0]?.values[0]?.[0] || 0
  const active = db.exec("SELECT COUNT(*) FROM tasks WHERE status IN ('in_progress','decomposing','feedback')")[0]?.values[0]?.[0] || 0
  const overdue = db.exec("SELECT COUNT(*) FROM tasks WHERE status = 'overdue'")[0]?.values[0]?.[0] || 0
  const completed = db.exec("SELECT COUNT(*) FROM tasks WHERE status = 'completed'")[0]?.values[0]?.[0] || 0
  const pending = db.exec("SELECT COUNT(*) FROM tasks WHERE status = 'pending'")[0]?.values[0]?.[0] || 0
  const review = db.exec("SELECT COUNT(*) FROM tasks WHERE status = 'review'")[0]?.values[0]?.[0] || 0

  res.json({ total, active, overdue, completed, pending, review })
})



// PUT /api/tasks/:id/outputs/:outputId/recall - Recall submitted output
router.put('/:id/outputs/:outputId/recall', authMiddleware, (req, res) => {
  const taskId = Number(req.params.id)
  const outputId = Number(req.params.outputId)
  const db = getDB()

  // Check output exists and belongs to the user
  const stmt = db.prepare('SELECT * FROM task_outputs WHERE id = ? AND task_id = ?')
  stmt.bind([outputId, taskId])
  const output = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!output) {
    return res.status(404).json({ error: '输出物不存在' })
  }

  if (output.user_id !== req.user.id) {
    return res.status(403).json({ error: '只能撤回自己提交的输出物' })
  }

  if (output.status !== 'pending') {
    return res.status(400).json({ error: '只能撤回待审核的输出物' })
  }

  // Delete the output
  db.run('DELETE FROM task_outputs WHERE id = ?', [outputId])

  // Add feedback record
  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "recall", ?)',
    [taskId, req.user.id, '撤回了提交的输出物'])

  const task = getFullTask(db, taskId)
  res.json({ task })
})

// PUT /api/tasks/:id/recall-complete - Recall completion request
router.put('/:id/recall-complete', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  if (task.status !== 'review') {
    return res.status(400).json({ error: '只能撤回待验收状态的任务' })
  }

  // Only the publisher or assignees can recall
  const canRecall = task.publisher_id === req.user.id || 
    task.assignees.some(a => a.id === req.user.id) ||
    task.supervisor_id === req.user.id

  if (!canRecall) {
    return res.status(403).json({ error: '权限不足' })
  }

  // Revert status to in_progress
  db.run('UPDATE tasks SET status = "in_progress", updated_at = datetime("now","localtime") WHERE id = ?', [id])

  // Add feedback record
  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "recall", ?)',
    [id, req.user.id, '撤回了完成验收申请'])

  const updated = getFullTask(db, id)
  res.json({ task: updated })
})

// PUT /api/tasks/:id/recall - Recall/cancel a task in pending or decomposing status
router.put('/:id/recall', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

  if (task.status !== 'pending' && task.status !== 'decomposing') {
    return res.status(400).json({ error: '只能撤回待开始或分解中的任务' })
  }

  const uid = req.user.id
  const isPublisher = task.publisher_id === uid
  const isSupervisor = task.supervisor_id === uid
  const isAdmin = ['admin', 'leader'].includes(req.user.role)

  if (!isPublisher && !isSupervisor && !isAdmin) {
    return res.status(403).json({ error: '权限不足，仅发起人、主管或管理员可撤回任务' })
  }

  db.run('UPDATE tasks SET status = "cancelled", updated_at = datetime("now","localtime") WHERE id = ?', [id])

  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "recall", ?)',
    [id, req.user.id, '撤回了任务'])

  const updated = getFullTask(db, id)
  res.json({ task: updated })
})

// DELETE /api/tasks/:id - Delete task (admin only)
router.delete('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const deleteAllowedRoles = ['admin', 'leader', 'supervisor']
  if (!deleteAllowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: '权限不足，仅管理员/主管/领导可删除任务' })
  }

  const taskCheck = db.prepare('SELECT id FROM tasks WHERE id = ?')
  taskCheck.bind([id])
  if (!taskCheck.step()) {
    taskCheck.free()
    return res.status(404).json({ error: '任务不存在' })
  }
  taskCheck.free()

  db.run('DELETE FROM feedbacks WHERE task_id = ?', [id])
  db.run('DELETE FROM task_outputs WHERE task_id = ?', [id])
  db.run('DELETE FROM task_assignees WHERE task_id = ?', [id])
  db.run('DELETE FROM subtasks WHERE task_id = ?', [id])
  db.run('DELETE FROM supervision_logs WHERE task_id = ?', [id])
  db.run('DELETE FROM tasks WHERE id = ?', [id])

  res.json({ message: '任务已删除' })
})

export default router
