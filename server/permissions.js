// 细粒度功能权限定义与解析
// 目前仅有一个独立权限：任务导入（下载模板 + Excel 导入发布任务）
// 存储在 users.permissions（JSON 数组字符串），管理员可通过账号管理页面配置给指定用户。

export const PERMISSIONS = {
  TASK_IMPORT: 'task_import'
}

export const PERMISSION_LABELS = {
  [PERMISSIONS.TASK_IMPORT]: '任务导入（下载模板/Excel 导入发布任务）'
}

// 管理员默认拥有全部权限
export function parsePermissions(raw, role) {
  if (role === 'admin') return Object.values(PERMISSIONS)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(p => typeof p === 'string') : []
  } catch (e) {
    // 兼容以逗号分隔的历史格式
    return String(raw).split(',').map(s => s.trim()).filter(Boolean)
  }
}

export function serializePermissions(list) {
  if (!Array.isArray(list)) return ''
  const known = Object.values(PERMISSIONS)
  const clean = Array.from(new Set(list.filter(p => known.includes(p))))
  return clean.length > 0 ? JSON.stringify(clean) : ''
}

export function hasPermission(user, permission) {
  if (!user) return false
  if (user.role === 'admin') return true
  return parsePermissions(user.permissions, user.role).includes(permission)
}

// Express 中间件工厂：要求某个细粒度权限
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: '权限不足：未获得该功能权限' })
    }
    next()
  }
}
