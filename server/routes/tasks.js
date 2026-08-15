import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Helper: get user object by id
function getUserById(db, id) {
  const stmt = db.prepare('SELECT id, username, name, role, title, department FROM users WHERE id = ?')
  stmt.bind([id])
  const user = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return user
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

  const oStmt = db.prepare(`
    SELECT o.*, u.name as reviewer_name
    FROM task_outputs o LEFT JOIN users u ON o.reviewer_id = u.id
    WHERE o.task_id = ? ORDER BY o.id DESC
  `)
  oStmt.bind([taskId])
  task.outputs = []
  while (oStmt.step()) {
    const row = oStmt.getAsObject()
    const submitter = getUserById(db, row.user_id)
    task.outputs.push({
      id: row.id,
      content: row.content,
      status: row.status,
      reviewComment: row.review_comment,
      reviewedAt: row.reviewed_at,
      submitter,
      reviewer: row.reviewer_name ? { id: row.reviewer_id, name: row.reviewer_name } : null,
      createdAt: row.created_at
    })
  }
  oStmt.free()

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

// GET /api/tasks - List tasks with filters
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const { status, priority, task_type, search, my_tasks } = req.query

  let sql = 'SELECT t.* FROM tasks t WHERE 1=1'
  const params = []

  if (status) { sql += ' AND t.status = ?'; params.push(status) }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority) }
  if (task_type) { sql += ' AND t.task_type = ?'; params.push(task_type) }
  if (search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
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
  const { title, description, task_type, priority, deadline, supervisor_id, assignee_ids, assignee_id, management_category, management_detail } = req.body

  if (!task_type) {
    return res.status(400).json({ error: '请选择任务类型' })
  }

  const db = getDB()
  const publisherId = req.user.id

  let supId = supervisor_id
  if (!supId) {
    if (task_type === 'self_repair' || task_type === 'rectification') {
      const s = db.prepare("SELECT id FROM users WHERE name = '李俊南' AND active = 1")
      if (s.step()) supId = s.getAsObject().id
      s.free()
    } else if (task_type === 'quality_analysis') {
      const s = db.prepare("SELECT id FROM users WHERE name = '蔡峥' AND active = 1")
      if (s.step()) supId = s.getAsObject().id
      s.free()
    }
  }

  const taskTitle = title && title.trim() 
    ? title.trim() 
    : `${taskTypeLabels[task_type] || task_type}任务`

  let initialStatus = 'pending'
  if (task_type === 'key_work') {
    initialStatus = 'in_progress'
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
    INSERT INTO tasks (title, description, task_type, priority, status, publisher_id, supervisor_id, assignee_id, deadline, management_category, management_detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [taskTitle, fullDescription, task_type, priority || 'normal', initialStatus, publisherId, supId || null, assignee_id || null, deadline || null, management_category || '', management_detail || ''])

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
router.put('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const db = getDB()

  const editAllowedRoles = ['admin', 'leader', 'supervisor_tech', 'supervisor_quality']
  if (!editAllowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: '权限不足，仅管理员/主管/领导可修改任务' })
  }

  const { title, description, priority, deadline, status, supervisor_id, task_type, assignee_id, management_category, management_detail } = req.body

  const updates = []
  const params = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority) }
  if (deadline !== undefined) { updates.push('deadline = ?'); params.push(deadline) }
  if (status !== undefined) { updates.push('status = ?'); params.push(status) }
  if (supervisor_id !== undefined) { updates.push('supervisor_id = ?'); params.push(supervisor_id) }
  if (task_type !== undefined) { updates.push('task_type = ?'); params.push(task_type) }
  if (management_category !== undefined) { updates.push('management_category = ?'); params.push(management_category) }
  if (management_detail !== undefined) { updates.push('management_detail = ?'); params.push(management_detail) }

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

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })
  res.json({ task })
})

// POST /api/tasks/:id/assign - Assign task to users
router.post('/:id/assign', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { assignee_ids, subtasks } = req.body
  const db = getDB()

  const task = getFullTask(db, id)
  if (!task) return res.status(404).json({ error: '任务不存在' })

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
router.post('/:id/subtasks', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { subtasks } = req.body
  const db = getDB()

  if (!subtasks || !Array.isArray(subtasks)) {
    return res.status(400).json({ error: '请提供子任务列表' })
  }

  for (const st of subtasks) {
    db.run('INSERT INTO subtasks (task_id, title, assignee_id) VALUES (?, ?, ?)', [id, st.title, st.assignee_id])
  }

  db.run('UPDATE tasks SET status = "in_progress", updated_at = datetime("now","localtime") WHERE id = ? AND status = "pending"', [id])

  const task = getFullTask(db, id)
  res.json({ task })
})

// PUT /api/tasks/:id/subtasks/:subId - Update subtask
router.put('/:id/subtasks/:subId', authMiddleware, (req, res) => {
  const taskId = Number(req.params.id)
  const subId = Number(req.params.subId)
  const { status, progress } = req.body
  const db = getDB()

  const updates = []
  const params = []
  if (status !== undefined) { updates.push('status = ?'); params.push(status) }
  if (progress !== undefined) { updates.push('progress = ?'); params.push(progress) }

  if (updates.length > 0) {
    params.push(subId, taskId)
    db.run(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ? AND task_id = ?`, params)
  }

  recalcProgress(db, taskId)
  const task = getFullTask(db, taskId)
  res.json({ task })
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

// POST /api/tasks/:id/submit-output - Staff submits output
router.post('/:id/submit-output', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { content, subtask_id } = req.body
  const userId = req.user.id
  const db = getDB()

  if (!content) return res.status(400).json({ error: '请填写输出物' })

  // Use explicit subtask_id if provided, otherwise auto-associate
  let resolvedSubtaskId = subtask_id || null
  if (!resolvedSubtaskId) {
    const subStmt = db.prepare('SELECT id FROM subtasks WHERE task_id = ? AND assignee_id = ? AND status != "completed" ORDER BY id LIMIT 1')
    subStmt.bind([id, userId])
    const subtask = subStmt.step() ? subStmt.getAsObject() : null
    subStmt.free()
    resolvedSubtaskId = subtask?.id || null
  }

  db.run(`
    INSERT INTO task_outputs (task_id, subtask_id, user_id, content) 
    VALUES (?, ?, ?, ?)
  `, [id, resolvedSubtaskId, userId, content])

  db.run('INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (?, ?, "output", ?)',
    [id, userId, `提交输出物: ${content}`])

  // For key_work and daily_management: move to review status after output submitted
  const taskRow = db.prepare('SELECT task_type, status FROM tasks WHERE id = ?')
  taskRow.bind([id])
  const tInfo = taskRow.step() ? taskRow.getAsObject() : null
  taskRow.free()
  if (tInfo && (tInfo.task_type === 'key_work' || tInfo.task_type === 'daily_management' || tInfo.status === 'overdue') && tInfo.status !== 'review') {
    db.run('UPDATE tasks SET status = "review", updated_at = datetime("now","localtime") WHERE id = ?', [id])
  }

  const task = getFullTask(db, id)
  res.json({ task })
})

// POST /api/tasks/:id/review-output - Supervisor reviews output
router.post('/:id/review-output', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { output_id, approved, comment } = req.body
  const db = getDB()

  if (!output_id) return res.status(400).json({ error: '缺少输出物ID' })

  const status = approved ? 'approved' : 'rejected'
  db.run(`
    UPDATE task_outputs SET status = ?, reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now','localtime')
    WHERE id = ? AND task_id = ?
  `, [status, req.user.id, comment || '', output_id, id])

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
        // For overdue/key_work tasks, require leader final approval
        const tCheck = db.prepare('SELECT task_type, status FROM tasks WHERE id = ?')
        tCheck.bind([id])
        const tRow = tCheck.step() ? tCheck.getAsObject() : null
        tCheck.free()
        if (tRow && (tRow.task_type === 'key_work' || tRow.status === 'overdue')) {
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

// POST /api/tasks/:id/approve-final - Leader gives final approval
router.post('/:id/approve-final', authMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const { approved, comment } = req.body
  const db = getDB()

  if (approved) {
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

  const deleteAllowedRoles = ['admin', 'leader', 'supervisor_tech', 'supervisor_quality']
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
