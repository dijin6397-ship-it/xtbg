import jwt from 'jsonwebtoken'
import { getDB } from '../db.js'

const JWT_SECRET = 'collab-platform-secret-key-2026'
const JWT_EXPIRES = '7d'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }
  try {
    const token = header.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET)
    const db = getDB()
    const stmt = db.prepare('SELECT id, username, name, role, title, department, active, employee_code, department_code FROM users WHERE id = ?')
    stmt.bind([decoded.id])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      if (!row.active) {
        return res.status(403).json({ error: '账号已禁用' })
      }
      req.user = row
      next()
    } else {
      stmt.free()
      return res.status(401).json({ error: '用户不存在' })
    }
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '无权限' })
    }
    next()
  }
}
