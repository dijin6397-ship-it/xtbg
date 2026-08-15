import initSqlJs from 'sql.js'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { allEmployees, allDepartments, allModules } from './seed-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'data.db')

let db = null

export async function initDB() {
  const SQL = await initSqlJs()
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA journal_mode=WAL')
  db.run('PRAGMA foreign_keys=ON')

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      title TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      employee_code TEXT DEFAULT '',
      department_code TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      task_type TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      department TEXT DEFAULT '',
      publisher_id INTEGER REFERENCES users(id),
      supervisor_id INTEGER REFERENCES users(id),
      deadline TEXT,
      assignee_id INTEGER,
      management_category TEXT DEFAULT '',
      management_detail TEXT DEFAULT '',
      completed_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      PRIMARY KEY (task_id, user_id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      assignee_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      deadline TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS task_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      subtask_id INTEGER,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewer_id INTEGER,
      review_comment TEXT DEFAULT '',
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      type TEXT DEFAULT 'progress',
      content TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS supervision_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'urge',
      operator_id INTEGER REFERENCES users(id),
      target_id INTEGER REFERENCES users(id),
      content TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      task_id INTEGER,
      type TEXT DEFAULT 'urge',
      title TEXT DEFAULT '',
      content TEXT,
      new_deadline TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS user_modules (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, module_id)
    )
  `)

  return db
}

export function getDB() {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function saveDB() {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

export function seedIfEmpty() {
  const count = db.exec('SELECT COUNT(*) as c FROM users')[0]?.values[0]?.[0] || 0
  if (count > 0) {
    importOrgData()
    return
  }

  const bcryptHash = bcrypt.hashSync('123456', 10)

  const users = [
    ['admin',     bcryptHash, '管理员',   '公司',       'admin',            '管理员',      '013265003'],
    ['guanyujing',bcryptHash, '关宇敬',   '技术质量部', 'leader',           '总经理助理',  '013200029620'],
    ['fuwei',     bcryptHash, '付巍',     '技术质量部', 'leader',           '技术总监',    '013265000138'],
    ['xuwenbin',  bcryptHash, '徐文彬',   '技术质量部', 'leader',           '部门副经理',  '013265000009'],
    ['lijunnan',  bcryptHash, '李俊南',   '技术质量部', 'supervisor_tech',  '研发主管',    '013265000112'],
    ['caizheng',  bcryptHash, '蔡峥',     '技术质量部', 'supervisor_quality','质量主管',   '013265000039'],
    ['yangchen',  bcryptHash, '杨晨',     '技术质量部', 'staff_tech',       '技术员',      '013265000046'],
    ['caoyifeng', bcryptHash, '曹毅峰',   '技术质量部', 'staff_tech',       '技术员',      '013265000045'],
    ['yaoyichao', bcryptHash, '姚逸超',   '技术质量部', 'staff_tech',       '技术员',      '013265000069'],
    ['shiyunjie', bcryptHash, '施云杰',   '技术质量部', 'staff_tech',       '技术员',      '013265000028'],
    ['zhenglibang',bcryptHash,'郑李鼎邦', '技术质量部', 'staff_tech',       '技术员',      '013265000109'],
    ['jiziwei',   bcryptHash, '吉自伟',   '技术质量部', 'staff_tech',       '技术员',      '013265000113'],
    ['zhoutianyi',bcryptHash, '周天怡',   '技术质量部', 'staff_tech',       '技术员',      '013265000115'],
    ['wenxiaoyu', bcryptHash, '翁晓瑜',   '技术质量部', 'staff_tech',       '技术员',      '013265000116'],
    ['duyexin',   bcryptHash, '杜晔昕',   '技术质量部', 'staff_tech',       '技术员',      '013265000005'],
    ['youwenjie', bcryptHash, '尤文杰',   '技术质量部', 'staff_tech',       '技术员',      '013265000136'],
    ['shiyifei',  bcryptHash, '施逸飞',   '技术质量部', 'staff_tech',       '技术员',      '013265000134'],
    ['wuminwen',  bcryptHash, '吴闵雯',   '技术质量部', 'staff_tech',       '技术员',      '013265000077'],
    ['zhengyiming',bcryptHash,'郑一鸣',   '技术质量部', 'staff_tech',       '技术员',      '013265000145'],
    ['jiangdongxin',bcryptHash,'姜东昕', '技术质量部', 'staff_tech',       '技术员',      '013265000146'],
    ['sudan',     bcryptHash, '苏丹',     '技术质量部', 'staff_tech',       '技术员',      '013200028358'],
    ['taojun',    bcryptHash, '陶俊',     '技术质量部', 'staff_quality',    '质量员',      '013265000017'],
    ['huangshi',  bcryptHash, '黄石',     '技术质量部', 'staff_quality',    '质量员',      '013265000037'],
    ['wangweizhong',bcryptHash,'王伟忠', '技术质量部', 'staff_quality',    '质量员',      '013265000012'],
    ['xiejiabin', bcryptHash, '谢佳斌',   '技术质量部', 'staff_quality',    '质量员',      '013265000018'],
    ['gongkaihua',bcryptHash, '龚凯华',   '技术质量部', 'staff_quality',    '质量员',      '013265000051'],
    ['zhaobinyu', bcryptHash, '赵滨钰',   '技术质量部', 'staff_quality',    '质量员',      '013265000140'],
    ['zhangminjie',bcryptHash,'张敏捷',   '技术质量部', 'staff_quality',    '质量员',      '013265000020'],
    ['hujiayi',   bcryptHash, '胡嘉毅',   '技术质量部', 'staff_quality',    '质量员',      '013265000013'],
    ['gaoyingte', bcryptHash, '高英特',   '技术质量部', 'staff_quality',    '质量员',      '013265000131'],
  ]

  const stmt = db.prepare('INSERT INTO users (username, password, name, department, role, title, department_code, employee_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const u of users) {
    stmt.run([u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[6]])
  }
  stmt.free()

  db.run(`INSERT INTO tasks (title, description, task_type, priority, status, progress, publisher_id, supervisor_id, deadline) VALUES ('生产异常处置（3号线电气故障）', '3号线生产过程中出现电气控制系统异常，PLC通讯中断导致产线停机。', 'self_repair', 'urgent', 'in_progress', 55, 2, 5, '2026-05-20'), ('新产品BOM编制', '完成新产品V3.2版本的完整BOM编制工作。', 'rectification', 'high', 'decomposing', 0, 3, 5, '2026-05-25'), ('现场质量问题处理', '2号线产品外观质量问题分析及改进方案制定。', 'quality_analysis', 'urgent', 'in_progress', 40, 2, 6, '2026-05-18')`)
  db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (1, 7), (1, 8), (2, 9), (3, 22)`)
  db.run(`INSERT INTO subtasks (task_id, title, assignee_id, status, progress) VALUES (1, '现场技术支持与故障排查', 7, 'in_progress', 60), (1, '技术方案编写', 8, 'pending', 0), (3, '质量问题分析报告', 22, 'in_progress', 40)`)
  db.run(`INSERT INTO feedbacks (task_id, user_id, type, content) VALUES (1, 7, 'progress', '现场排查中，已定位到具体故障点位'), (3, 22, 'progress', '质量问题分析进行中')`)

  importOrgData()
  saveDB()
}

function importOrgData() {
  const bcryptHash = bcrypt.hashSync('123456', 10)

  for (const dept of allDepartments) {
    try { db.run('INSERT OR IGNORE INTO departments (code, name) VALUES (?, ?)', [dept.code, dept.name]) } catch(e) {}
  }

  for (const mod of allModules) {
    try { db.run('INSERT OR IGNORE INTO modules (module_key, name, path, description, sort_order) VALUES (?, ?, ?, ?, ?)', [mod.key, mod.name, mod.path, mod.description, mod.sort_order]) } catch(e) {}
  }

  const existingUsers = db.exec('SELECT id, name, department FROM users')
  const existingNames = {}
  if (existingUsers.length > 0) {
    for (const row of existingUsers[0].values) {
      existingNames[row[1] + '_' + row[2]] = row[0]
    }
  }

  const insertUser = db.prepare('INSERT INTO users (username, password, name, department, role, title, employee_code, department_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const updateEmpCode = db.prepare('UPDATE users SET employee_code = ?, department_code = ? WHERE id = ?')

  for (const emp of allEmployees) {
    const empCode = emp[0], name = emp[1], deptCode = emp[2], deptName = emp[3]
    const key = name + '_' + deptName
    if (existingNames[key]) {
      try { updateEmpCode.run([empCode, deptCode, existingNames[key]]) } catch(e) {}
    } else {
      try { insertUser.run([empCode, bcryptHash, name, deptName, 'user', '', empCode, deptCode]) } catch(e) {}
    }
  }
  insertUser.free()
  updateEmpCode.free()

  const modRows = db.exec('SELECT id, module_key FROM modules')
  const modMap = {}
  if (modRows.length > 0) {
    for (const row of modRows[0].values) { modMap[row[1]] = row[0] }
  }

  const tqModId = modMap['tech_quality']
  if (tqModId) {
    const tqUsers = db.exec("SELECT id FROM users WHERE department = '技术质量部'")
    if (tqUsers.length > 0) {
      for (const row of tqUsers[0].values) {
        try { db.run('INSERT OR IGNORE INTO user_modules (user_id, module_id) VALUES (?, ?)', [row[0], tqModId]) } catch(e) {}
      }
    }
  }

    db.run("UPDATE users SET department = '公司' WHERE username = 'admin'")

const adminUser = db.exec("SELECT id FROM users WHERE username = 'admin'")
  if (adminUser.length > 0) {
    const adminId = adminUser[0].values[0][0]
    for (const modId of Object.values(modMap)) {
      try { db.run('INSERT OR IGNORE INTO user_modules (user_id, module_id) VALUES (?, ?)', [adminId, modId]) } catch(e) {}
    }
  }

  saveDB()
}
