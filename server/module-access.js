import { getDB } from './db.js'

// 后台管理模块 key
export const BACKEND_MODULE_KEY = 'admin_backend'

// 判断用户是否拥有某个模块权限
// - admin 默认拥有全部模块
// - 其他用户需在 user_modules 中被授予该模块
export function userHasModule(userId, moduleKey, role) {
  if (role === 'admin') return true
  const db = getDB()
  const stmt = db.prepare(`
    SELECT COUNT(*) AS c FROM user_modules um
    JOIN modules m ON um.module_id = m.id
    WHERE um.user_id = ? AND m.module_key = ?
  `)
  stmt.bind([userId, moduleKey])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return (row?.c || 0) > 0
}

// Express 中间件：要求拥有「后台管理」模块权限
export function requireBackendModule(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录' })
  if (req.user.role === 'admin') return next()
  if (userHasModule(req.user.id, BACKEND_MODULE_KEY, req.user.role)) return next()
  return res.status(403).json({ error: '权限不足：未获得「后台管理」模块权限' })
}
