import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDB } from '../db.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

function getUserModules(db, userId, role) {
  if (role === 'admin') {
    const rows = db.exec('SELECT module_key, name, path, description FROM modules ORDER BY sort_order')
    return rows.length > 0 ? rows[0].values.map(r => ({ moduleKey: r[0], name: r[1], path: r[2], description: r[3] })) : []
  }
  const rows = db.exec('SELECT m.module_key, m.name, m.path, m.description FROM modules m JOIN user_modules um ON m.id = um.module_id WHERE um.user_id = ' + userId + ' ORDER BY m.sort_order')
  return rows.length > 0 ? rows[0].values.map(r => ({ moduleKey: r[0], name: r[1], path: r[2], description: r[3] })) : []
}

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }
    const db = getDB()
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    stmt.bind([username])
    if (!stmt.step()) {
      stmt.free()
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    const user = stmt.getAsObject()
    stmt.free()
    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    const token = generateToken(user)
    const { password: _, ...safeUser } = user
    safeUser.modules = getUserModules(db, user.id, user.role)
    res.json({ token, user: safeUser })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/me', authMiddleware, (req, res) => {
  const db = getDB()
  const user = { ...req.user }
  user.modules = getUserModules(db, user.id, user.role)
  res.json({ user })
})

router.put('/password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入原密码和新密码' })
    }
    const db = getDB()
    const stmt = db.prepare('SELECT password FROM users WHERE id = ?')
    stmt.bind([req.user.id])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    if (!row) return res.status(404).json({ error: '用户不存在' })
    const valid = bcrypt.compareSync(oldPassword, row.password)
    if (!valid) return res.status(401).json({ error: '原密码错误' })
    const hash = bcrypt.hashSync(newPassword, 10)
    db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id])
    res.json({ message: '密码修改成功' })
  } catch (err) {
    console.error('Password change error:', err)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router
