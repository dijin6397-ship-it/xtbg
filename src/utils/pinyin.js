/**
 * 姓名拼音检索工具
 *
 * 后端用户表只有中文 name（如「张明」），前端通过 pinyin-pro 实时计算出：
 *   - 全拼（无声调、无空格）：zhangming
 *   - 严格首字母：zm
 *   - 声母首字母（zh/ch/sh 视为一个声母）：zhm
 * 因此无需改动数据库或后端接口，即可支持「中文名 / 拼音 / 拼音简写」模糊查询。
 *
 * 拼音词典体积较大（gzip 约 140KB），这里做成按需加载：
 * 组件挂载时调用 ensurePinyinReady() 异步加载，加载完成前中文名/账号/部门照常搜索，
 * 加载完成后自动补上拼音与拼音简写检索能力，不阻塞页面首屏。
 */

let pinyinFn = null
let loadingPromise = null

const cache = new Map()
const CACHE_LIMIT = 2000

function readCache(key) {
  return cache.get(key)
}

function writeCache(key, value) {
  if (cache.size > CACHE_LIMIT) cache.clear()
  cache.set(key, value)
  return value
}

/** 异步加载拼音词典，返回是否可用（失败时不抛错，降级为仅中文检索） */
export function ensurePinyinReady() {
  if (pinyinFn) return Promise.resolve(true)
  if (!loadingPromise) {
    loadingPromise = import('pinyin-pro')
      .then(mod => {
        pinyinFn = mod.pinyin
        return true
      })
      .catch(() => {
        loadingPromise = null
        return false
      })
  }
  return loadingPromise
}

/** 拼音词典是否已就绪 */
export function isPinyinReady() {
  return !!pinyinFn
}

/** 规范化查询词：转小写、去掉空格与常见分隔符 */
export function normalizeQuery(query) {
  if (!query) return ''
  return String(query).toLowerCase().replace(/[\s\-_.]/g, '')
}

/** 取姓名全拼（无声调、无空格），如「张明」-> zhangming；词典未就绪时返回空串 */
export function getPinyin(name) {
  if (!name || !pinyinFn) return ''
  const key = 'full:' + name
  const hit = readCache(key)
  if (hit !== undefined) return hit
  let result = ''
  try {
    result = pinyinFn(String(name), {
      toneType: 'none',
      type: 'array',
      nonZh: 'consecutive',
      surname: 'head'
    }).join('').toLowerCase().replace(/\s+/g, '')
  } catch (e) {
    result = ''
  }
  return writeCache(key, result)
}

/**
 * 取姓名拼音首字母（词典未就绪时返回空串）。
 * 同时返回两种形式，便于不同输入习惯的匹配：
 *   - strict: 每个音节的首字母，张明 -> zm
 *   - phonetic: 按声母分组，张明 -> zhm（zh/ch/sh 作为整体）
 */
export function getPinyinInitials(name) {
  if (!name || !pinyinFn) return { strict: '', phonetic: '' }
  const key = 'initials:' + name
  const hit = readCache(key)
  if (hit !== undefined) return hit
  let strict = ''
  let phonetic = ''
  try {
    strict = pinyinFn(String(name), {
      pattern: 'first',
      toneType: 'none',
      type: 'array',
      nonZh: 'consecutive',
      surname: 'head'
    }).join('').toLowerCase().replace(/\s+/g, '')
    phonetic = pinyinFn(String(name), {
      pattern: 'initial',
      toneType: 'none',
      type: 'array',
      nonZh: 'consecutive',
      surname: 'head'
    }).join('').toLowerCase().replace(/\s+/g, '')
  } catch (e) {
    strict = ''
    phonetic = ''
  }
  return writeCache(key, { strict, phonetic })
}

/**
 * 人员匹配打分：分数越高越靠前，0 表示不匹配。
 * 支持中文名、全拼、拼音首字母（含 zh/ch/sh 声母简写）、工号/账号、部门。
 * 多个维度命中时取最高分，避免「账号恰好等于拼音」压过真正的拼音全等命中。
 */
export function scorePerson(person, rawQuery) {
  if (!person) return 0
  const query = normalizeQuery(rawQuery)
  if (!query) return 1

  const name = String(person.name || '')
  const nameLower = name.toLowerCase()
  const username = String(person.username || '').toLowerCase()
  const employeeCode = String(person.employee_code || '').toLowerCase()
  const department = String(person.department || person.dept || '').toLowerCase()

  let score = 0
  const bump = value => {
    if (value > score) score = value
  }

  // 中文名精确 / 前缀 / 包含（query 已去掉空格，允许「张 明」这类输入）
  if (name) {
    if (name === query) bump(100)
    else if (nameLower.startsWith(query)) bump(95)
    else if (name.includes(query)) bump(85)
  }

  // 拼音相关（词典未就绪时 getPinyin 返回空串，自动跳过）
  const full = getPinyin(name)
  if (full) {
    if (full === query) bump(92)
    else if (full.startsWith(query)) bump(82)
    else if (full.includes(query)) bump(72)
  }

  // 拼音首字母（严格 / 声母两种写法都支持）
  const { strict, phonetic } = getPinyinInitials(name)
  if ((strict && strict === query) || (phonetic && phonetic === query)) bump(88)
  if ((strict && strict.startsWith(query)) || (phonetic && phonetic.startsWith(query))) bump(78)
  if ((strict && strict.includes(query)) || (phonetic && phonetic.includes(query))) bump(68)

  // 账号 / 工号（优先级低于姓名与拼音）
  if (username && username.includes(query)) bump(60)
  if (employeeCode && employeeCode.includes(query)) bump(60)

  // 部门（方便按部门筛选人员）
  if (department && department.includes(query)) bump(40)

  return score
}

/** 是否匹配 */
export function matchPerson(person, query) {
  return scorePerson(person, query) > 0
}

/** 按查询词过滤并排序人员列表 */
export function filterPersons(persons, query) {
  const list = Array.isArray(persons) ? persons : []
  if (!normalizeQuery(query)) return list
  return list
    .map(person => ({ person, score: scorePerson(person, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.person)
}
