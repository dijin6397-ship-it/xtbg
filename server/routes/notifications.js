import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/notifications - List notifications for current user
router.get('/', authMiddleware, (req, res) => {
  const db = getDB()
  const userId = req.user.id

  const stmt = db.prepare(`
    SELECT n.*, t.title as task_title
    FROM notifications n
    LEFT JOIN tasks t ON n.task_id = t.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `)
  stmt.bind([userId])

  const notifications = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    notifications.push({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      type: row.type,
      title: row.title,
      content: row.content,
      newDeadline: row.new_deadline,
      isRead: !!row.is_read,
      createdAt: row.created_at
    })
  }
  stmt.free()

  const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
  unread.bind([userId])
  const unreadCount = unread.step() ? unread.getAsObject().c : 0
  unread.free()

  res.json({ notifications, unreadCount })
})

// PUT /api/notifications/read - Mark notifications as read
router.put('/read', authMiddleware, (req, res) => {
  const db = getDB()
  const userId = req.user.id
  const { ids } = req.body

  if (ids && Array.isArray(ids) && ids.length > 0) {
    for (const nid of ids) {
      db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [nid, userId])
    }
  } else {
    db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId])
  }

  res.json({ message: '已标记为已读' })
})

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB()
  const nid = Number(req.params.id)
  db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [nid, req.user.id])
  res.json({ message: '已删除' })
})

export default router
