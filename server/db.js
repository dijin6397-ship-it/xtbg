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

  // Migration: ensure new columns on task_outputs for existing DBs
  try {
    const cols = db.exec("PRAGMA table_info(task_outputs)")
    const existing = cols[0] ? cols[0].values.map(r => r[1]) : []
    const addCol = (name, type) => {
      if (!existing.includes(name)) {
        try { db.run(`ALTER TABLE task_outputs ADD COLUMN ${name} ${type}`) } catch (e) {}
      }
    }
    addCol('category_l1', 'INTEGER REFERENCES dict_categories(id)')
    addCol('category_l2', 'INTEGER REFERENCES dict_categories(id)')
    addCol('category_l3', 'INTEGER REFERENCES dict_categories(id)')
    addCol('score_value', 'REAL DEFAULT 0')
    addCol('score_quantity', 'REAL DEFAULT 0')
    addCol('score_rule', "TEXT DEFAULT ''")
    addCol('score_total', 'REAL DEFAULT 0')
  } catch (e) { /* noop */ }

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
      category_l1 INTEGER REFERENCES dict_categories(id),
      category_l2 INTEGER REFERENCES dict_categories(id),
      category_l3 INTEGER REFERENCES dict_categories(id),
      score_value REAL DEFAULT 0,
      score_quantity REAL DEFAULT 0,
      score_rule TEXT DEFAULT '',
      score_total REAL DEFAULT 0,
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

  // ============ Data Dictionary (一/二/三级分类) ============
  db.run(`
    CREATE TABLE IF NOT EXISTS dict_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL,            -- 1 / 2 / 3
      parent_id INTEGER REFERENCES dict_categories(id) ON DELETE CASCADE,
      code TEXT DEFAULT '',
      name TEXT NOT NULL,
      score_rule TEXT DEFAULT 'fixed',  -- 'fixed' | 'range' | 'any'
      score_value REAL DEFAULT 0,        -- fixed value or range lower bound
      score_upper REAL DEFAULT 0,        -- range upper bound (unused for 'any' / 'fixed')
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_dict_parent ON dict_categories(parent_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_dict_level ON dict_categories(level)`)

  // Migration: daily_management tasks don't need decompose/assign flow,
  // auto-set historical pending ones to in_progress so supervisors/leaders can submit outputs directly
  try {
    db.run(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now','localtime') WHERE task_type = 'daily_management' AND status = 'pending'`)
  } catch (e) { /* noop */ }

  // Migration: daily_management 任务“谁发起谁负责”，历史任务 supervisor 为空时默认设为发起人，
  // 保证报表“主管”字段有值，且发起人（含主管/领导）可自行提交输出物并审核
  try {
    db.run(`UPDATE tasks SET supervisor_id = publisher_id, updated_at = datetime('now','localtime') WHERE task_type = 'daily_management' AND supervisor_id IS NULL`)
  } catch (e) { /* noop */ }

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
    seedDictionaryIfEmpty()
    saveDB()
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

  seedDictionaryIfEmpty()
  saveDB()
}

// ============================================================
// Default data dictionary (一/二/三级分类 + score rules) - from 任务清单.xlsx
// ============================================================
function seedDictionaryIfEmpty() {
  const existing = db.exec('SELECT COUNT(*) FROM dict_categories')
  const count = existing[0]?.values[0]?.[0] || 0
  if (count > 0) return

  // 完整层级来自 任务清单.xlsx
  const tree = [
    {
      name: '日常项目工作', l2: [
        { name: '技术通知（临时作业、申购等。临时作业：拆倒件或只有一个作业记录单的等）', l3: [
          { name: '内容编制', rule: 'fixed', score: 0.025 },
          { name: 'SAP系统流程', rule: 'fixed', score: 0.025 }
        ]},
        { name: '技术通知（工艺文件、说明文件、方案等）', l3: [
          { name: '内容编制', rule: 'fixed', score: 0.1 },
          { name: 'SAP系统流程', rule: 'fixed', score: 0.1 }
        ]},
        { name: '说明文件（提供给业主、项目部等的临时性文件）', l3: [
          { name: '说明文件', rule: 'fixed', score: 0.5 }
        ]},
        { name: '结构装配方案、整改方案（含记录单）', l3: [
          { name: '结构装配方案、整改方案', rule: 'fixed', score: 5 }
        ]},
        { name: '试验/布线方案（含记录单）', l3: [
          { name: '试验/布线方案', rule: 'fixed', score: 7 }
        ]},
        { name: '普查、跟踪方案（含记录单）', l3: [
          { name: '普查、跟踪方案', rule: 'fixed', score: 3 }
        ]},
        { name: '专报（故障专报、运营专报）', l3: [
          { name: '专报', rule: 'fixed', score: 1.5 }
        ]},
        { name: '替代材料', l3: [
          { name: '替代材料', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '清单（配置清单、故障分析汇总清单、各类汇总表）', l3: [
          { name: '清单', rule: 'fixed', score: 0.2 }
        ]},
        { name: '请示（临修、申购、各类申请）', l3: [
          { name: '请示', rule: 'fixed', score: 0.2 }
        ]},
        { name: '技术变更申请表', l3: [
          { name: '技术变更申请表', rule: 'fixed', score: 0.1 }
        ]},
        { name: '现场技术服务', l3: [
          { name: '现场技术服务', rule: 'range', score: 0.2, high: 1 }
        ]},
        { name: '动车故障查看及回复', l3: [
          { name: '动车故障查看及回复', rule: 'fixed', score: 0.2 }
        ]},
        { name: '生产异常回复', l3: [
          { name: '生产异常回复', rule: 'fixed', score: 0.5 }
        ]}
      ]
    },
    {
      name: '项目策划工作（架大修、TPM、自主修等）', l2: [
        { name: '工作计划', l3: [
          { name: '整体计划', rule: 'fixed', score: 1 },
          { name: '详细计划', rule: 'fixed', score: 3 }
        ]},
        { name: '工艺文件（包含：工艺、记录单、技规、BOM、方案、工艺流程图、工位配置表）', l3: [
          { name: '工艺文件', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '培训', l3: [
          { name: '内部培训资料', rule: 'range', score: 0.5, high: 1 },
          { name: '内部培训签到单', rule: 'range', score: 0.5, high: 1 },
          { name: '外部培训小结', rule: 'range', score: 2, high: 5 },
          { name: '培训考试题', rule: 'range', score: 0.5, high: 1 }
        ]},
        { name: '工艺验证记录', l3: [
          { name: '工艺验证记录', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '总体工艺文件', l3: [
          { name: '总体工艺文件', rule: 'fixed', score: 4 }
        ]},
        { name: '维修策略说明', l3: [
          { name: '维修策略说明', rule: 'fixed', score: 1 }
        ]},
        { name: '规程识别意见清单', l3: [
          { name: '规程识别意见清单', rule: 'range', score: 0.5, high: 3 }
        ]},
        { name: '风险识别清单（PFMEA）', l3: [
          { name: '风险识别清单', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '关键特殊过程输出物', l3: [
          { name: '关键特殊过程清单', rule: 'fixed', score: 2 },
          { name: '确认报告', rule: 'fixed', score: 0.2 },
          { name: '验证报告', rule: 'fixed', score: 0.2 },
          { name: '再确认报告', rule: 'fixed', score: 0.2 },
          { name: '控制计划', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '评审记录单', l3: [
          { name: '评审记录单', rule: 'fixed', score: 0.2 }
        ]},
        { name: '投标文件', l3: [
          { name: '投标文件', rule: 'range', score: 5, high: 15 }
        ]}
      ]
    },
    {
      name: '专项工作', l2: [
        { name: '工可报告', l3: [
          { name: '实施方案', rule: 'range', score: 2, high: 5 },
          { name: '资源清单', rule: 'fixed', score: 1 },
          { name: '经济性分析', rule: 'range', score: 1, high: 3 },
          { name: '其他', rule: 'any', score: 0 }
        ]},
        { name: '立项报告', l3: [
          { name: '立项报告', rule: 'fixed', score: 0.5 }
        ]},
        { name: '现场阶段性报告', l3: [
          { name: '调研报告', rule: 'range', score: 0.5, high: 2 },
          { name: '阶段性结项报告', rule: 'range', score: 2, high: 5 },
          { name: '验收报告及记录单（内部）', rule: 'range', score: 2, high: 5 }
        ]},
        { name: '预算清单', l3: [
          { name: '预算清单（公司级）', rule: 'range', score: 0.2, high: 1 },
          { name: '预算清单（部门级）', rule: 'range', score: 0.2, high: 0.5 },
          { name: '预算清单（项目级）', rule: 'fixed', score: 0.2 }
        ]},
        { name: '手册', l3: [
          { name: '维护手册（内部）', rule: 'range', score: 0.2, high: 1 },
          { name: '操作手册（内部）', rule: 'range', score: 0.5, high: 2 },
          { name: '点检基准书、记录单（内部）', rule: 'range', score: 0.2, high: 1 }
        ]},
        { name: '图纸（内部出图）', l3: [
          { name: '图纸（内部出图）', rule: 'range', score: 0.5, high: 5 }
        ]}
      ]
    },
    {
      name: '管理类', l2: [
        { name: '管理制度', l3: [
          { name: '制度文件编制', rule: 'range', score: 1, high: 5 },
          { name: '会签流程', rule: 'fixed', score: 0.5 }
        ]},
        { name: '通用工艺守则', l3: [
          { name: '通用工艺守则', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '汇报材料', l3: [
          { name: '项目周报', rule: 'fixed', score: 0.2 },
          { name: '周专项汇报材料', rule: 'fixed', score: 0.5 },
          { name: '外部汇报材料', rule: 'range', score: 0.5, high: 2 },
          { name: '内部汇报材料', rule: 'range', score: 0.5, high: 2 },
          { name: '其他临时性汇报材料', rule: 'any', score: 0 }
        ]},
        { name: '合同管理', l3: [
          { name: '询价记录单', rule: 'fixed', score: 0.2 },
          { name: '内部比选记录单', rule: 'fixed', score: 0.2 },
          { name: '单一来源物料采购谈判会议记录', rule: 'fixed', score: 0.2 },
          { name: '紧急采购物料采购谈判会议记录', rule: 'fixed', score: 0.2 },
          { name: '采购项目立项审批表', rule: 'fixed', score: 0.5 },
          { name: '采购合同会签表', rule: 'fixed', score: 0.5 },
          { name: '采购合同', rule: 'range', score: 0.2, high: 0.5 },
          { name: '采购订单', rule: 'fixed', score: 0.2 },
          { name: 'SAP系统采购订单', rule: 'fixed', score: 0.2 },
          { name: '紧急物料采购确认单（内部）', rule: 'fixed', score: 0.1 },
          { name: '发票预制', rule: 'fixed', score: 0.05 }
        ]},
        { name: '信息化系统', l3: [
          { name: 'MSBOM（SAP）', rule: 'fixed', score: 0.1 },
          { name: 'MSBOM（PDM）', rule: 'fixed', score: 0.1 },
          { name: '工程变更', rule: 'fixed', score: 0.05 },
          { name: 'SBOP（PDM）', rule: 'fixed', score: 0.1 },
          { name: '必修必换任务清单（SAP）', rule: 'fixed', score: 0.1 },
          { name: '结构化工艺及质量策划（PDM）', rule: 'range', score: 1, high: 3 },
          { name: '模型车（SAP）', rule: 'range', score: 0, high: 10 },
          { name: '实体车、单车构型（SAP）', rule: 'fixed', score: 0.1 },
          { name: '物料主数据-基础试图、工厂试图（SAP）', rule: 'fixed', score: 0.05 },
          { name: '文档（SAP）', rule: 'range', score: 0.1, high: 0.2 },
          { name: '车组数据（SMART）', rule: 'fixed', score: 0.5 },
          { name: '产线组工位（SMART）', rule: 'fixed', score: 0.5 },
          { name: '产线组产线（SMART）', rule: 'fixed', score: 0.5 },
          { name: '产线组台位（SMART）', rule: 'fixed', score: 0.5 },
          { name: '逻辑工位（SMART）', rule: 'fixed', score: 0.5 },
          { name: 'SBOP数据同步（SMART）', rule: 'fixed', score: 0.5 },
          { name: '检修车辆资质（SMART）', rule: 'fixed', score: 0.5 },
          { name: '工艺网络（SMART）', rule: 'fixed', score: 0.5 },
          { name: '检修模式（SMART）', rule: 'fixed', score: 0.5 },
          { name: 'SBOP顺序（SMART）', rule: 'fixed', score: 0.5 },
          { name: '列调配置（SMART）', rule: 'fixed', score: 0.5 },
          { name: '配置车型（SMART）', rule: 'fixed', score: 0.5 },
          { name: '产品构型/服务构型同步（SMART）', rule: 'fixed', score: 0.5 },
          { name: '工作中心（SAP、SMART）', rule: 'fixed', score: 0.5 },
          { name: '班组（SAP、SMART）', rule: 'fixed', score: 0.5 },
          { name: '质量专检', rule: 'fixed', score: 0.5 }
        ]},
        { name: '体系管理输出物（内/外审材料、整改措施等）', l3: [
          { name: '关键特殊过程证书', rule: 'range', score: 0.2, high: 1 },
          { name: '乌龟图', rule: 'range', score: 0.2, high: 1 },
          { name: '维修基线', rule: 'range', score: 0.2, high: 1 },
          { name: '配置状态清单', rule: 'range', score: 0.2, high: 1 },
          { name: '配置评审记录单', rule: 'fixed', score: 0.2 },
          { name: '技术变更申请表', rule: 'range', score: 0.2, high: 1 },
          { name: 'DFMEA、PFMEA', rule: 'range', score: 2, high: 5 },
          { name: '技术变更验证确认表', rule: 'range', score: 0.2, high: 1 }
        ]},
        { name: '请示', l3: [
          { name: '请示', rule: 'range', score: 0.2, high: 1 }
        ]},
        { name: '出差小结', l3: [
          { name: '出差小结', rule: 'range', score: 0.5, high: 2 }
        ]},
        { name: '会议纪要', l3: [
          { name: '验收报告及记录单（外部）', rule: 'fixed', score: 0.2 },
          { name: '会议纪要（外部）和工作分解清单', rule: 'range', score: 0.5, high: 2 },
          { name: '会议纪要（内部）和工作分解清单', rule: 'fixed', score: 0.2 }
        ]},
        { name: '付款计划', l3: [
          { name: '付款计划', rule: 'fixed', score: 0.5 }
        ]},
        { name: '支款凭证', l3: [
          { name: '支款凭证', rule: 'fixed', score: 0.5 }
        ]}
      ]
    },
    {
      name: '质量', l2: [
        { name: '合格证', l3: [
          { name: '合格证', rule: 'fixed', score: 0.05 }
        ]},
        { name: '暂缓执行项', l3: [
          { name: '风险评估表', rule: 'fixed', score: 0.2 },
          { name: '项目申报表', rule: 'fixed', score: 0.2 }
        ]},
        { name: 'PAC', l3: [
          { name: 'PAC', rule: 'fixed', score: 0.5 }
        ]},
        { name: '双5归零报告', l3: [
          { name: '双5归零报告', rule: 'fixed', score: 7 }
        ]},
        { name: '闭环开口项，输出闭环单', l3: [
          { name: '闭环开口项，输出闭环单', rule: 'fixed', score: 0.5 }
        ]},
        { name: '首检报告', l3: [
          { name: '首检报告', rule: 'fixed', score: 0.5 }
        ]}
      ]
    }
  ]

  let order = 1
  const insertCat = (level, parentId, name, rule, value, upper) => {
    db.run(`INSERT INTO dict_categories (level, parent_id, name, score_rule, score_value, score_upper, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [level, parentId, name, rule, value || 0, upper || 0, order++])
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  }

  for (const l1 of tree) {
    const l1Id = insertCat(1, null, l1.name, 'fixed', 0, 0)
    for (const l2 of (l1.l2 || [])) {
      const l2Id = insertCat(2, l1Id, l2.name, 'fixed', 0, 0)
      for (const l3 of (l2.l3 || [])) {
        insertCat(3, l2Id, l3.name, l3.rule || 'any', l3.score || 0, l3.high || 0)
      }
    }
  }
}