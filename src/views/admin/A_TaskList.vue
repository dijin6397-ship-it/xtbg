<template>
  <div class="task-list-page">
    <div class="page-header">
      <h2>任务管理</h2>
      <span class="summary">共 {{ filteredTasks.length }} 条任务</span>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input v-model="searchText" type="text" placeholder="搜索任务标题..." class="search-input" />
      </div>
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input v-model="publisherSearch" type="text" placeholder="搜索发起人..." class="search-input" />
      </div>
      <select v-model="filterPublisherId" class="form-select filter-select">
        <option value="">全部发起人</option>
        <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name || u.username }}</option>
      </select>
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M10 6.5h4a3 3 0 0 1 3 3v4"/></svg>
        <input v-model="wbsProjectSearch" type="text" placeholder="搜索项目号(WBS)..." class="search-input" />
      </div>
      <select v-model="filterWbsProjectId" class="form-select filter-select">
        <option value="">全部项目号</option>
        <option v-for="p in wbsProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M6 17V9a6 6 0 0 1 12 0v8"/><circle cx="8" cy="21" r="1"/><circle cx="16" cy="21" r="1"/></svg>
        <input v-model="wbsCarSearch" type="text" placeholder="搜索车号..." class="search-input" />
      </div>
      <select v-model="filterWbsCarId" class="form-select filter-select">
        <option value="">全部车号</option>
        <option v-for="c in wbsCars" :key="c.id" :value="c.id">{{ c.name }}{{ c.projectName ? ' (' + c.projectName + ')' : '' }}</option>
      </select>
      <button class="btn btn-export" @click="exportExcel">📊 导出Excel</button>
      <template v-if="canImportTasks">
        <button class="btn btn-template" :disabled="downloading" @click="downloadTemplate">
          {{ downloading ? '下载中...' : '📥 下载模板' }}
        </button>
        <button class="btn btn-template" :disabled="importing" @click="triggerImport">
          {{ importing ? '上传中...' : '📤 导入Excel' }}
        </button>
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="file-input" @change="handleImportFile" />
      </template>
      <div class="filter-group">
        <select v-model="filterType" class="form-select filter-select">
          <option value="">全部类型</option>
          <option value="self_repair">自主修</option>
          <option value="rectification">问题整改</option>
          <option value="quality_analysis">现场质量问题分析</option>
          <option value="key_work">部门重点工作</option>
          <option value="daily_management">部门日常管理</option>
        </select>
        <select v-model="filterStatus" class="form-select filter-select">
          <option value="">全部状态</option>
          <option v-for="(info, key) in statusMap" :key="key" :value="key">{{ info.label }}</option>
        </select>
        <select v-model="filterPriority" class="form-select filter-select">
          <option value="">全部优先级</option>
          <option v-for="(info, key) in priorityMap" :key="key" :value="key">{{ info.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="importResult" class="import-panel">
      <div class="import-panel-head">
        <strong>导入结果</strong>
        <button class="btn btn-sm" @click="importResult = null">关闭</button>
      </div>
      <p class="import-summary">
        共 {{ importResult.total }} 条，成功创建 <b class="ok">{{ importResult.created }}</b> 条，
        失败 <b :class="importResult.failed ? 'fail' : ''">{{ importResult.failed }}</b> 条
        <span v-if="importResult.batch" class="import-batch">批次：{{ importResult.batch }}</span>
      </p>
      <div v-if="importErrors.length" class="import-errors">
        <div class="import-errors-title">失败明细</div>
        <ul>
          <li v-for="(err, i) in importErrors" :key="i">
            <span class="err-row">第 {{ err.row }} 行</span>{{ err.message }}
          </li>
        </ul>
      </div>
      <p v-else class="import-all-ok">全部数据导入成功。</p>
    </div>

    <div class="card table-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="filteredTasks.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-caption)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>没有找到匹配的任务</p>
      </div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>任务标题</th>
              <th>类型</th>
              <th>优先级</th>
              <th>状态</th>
              <th>发起人</th>
              <th>项目号(WBS)</th>
              <th>车号</th>
              <th>主管</th>
              <th>进度</th>
              <th>截止日期</th>
              <th>实际完成日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in filteredTasks" :key="task.id">
              <td class="cell-id">#{{ task.id }}</td>
              <td class="cell-title">{{ task.title }}</td>
              <td>
                <span class="tag" :style="{ color: taskTypeMap[task.task_type]?.color, background: taskTypeMap[task.task_type]?.bg }">
                  {{ taskTypeMap[task.task_type]?.label || task.task_type }}
                </span>
              </td>
              <td>
                <span class="tag" :style="{ color: priorityMap[task.priority]?.color, background: priorityMap[task.priority]?.bg }">
                  {{ priorityMap[task.priority]?.label }}
                </span>
              </td>
              <td>
                <span class="tag" :style="{ color: statusMap[task.status]?.color, background: statusMap[task.status]?.bg }">
                  {{ statusMap[task.status]?.label }}
                </span>
              </td>
              <td>{{ task.publisher?.name }}</td>
              <td class="cell-wbs">
                <span v-if="task.wbsProjectNames?.length" class="wbs-tag">{{ task.wbsProjectNames.join('、') }}</span>
                <span v-else class="cell-empty">-</span>
              </td>
              <td class="cell-wbs">
                <span v-if="task.wbsCarNames?.length" class="wbs-tag wbs-tag-car">{{ task.wbsCarNames.join('、') }}</span>
                <span v-else class="cell-empty">-</span>
              </td>
              <td>{{ task.supervisor?.name }}</td>
              <td>
                <div class="cell-progress">
                  <div class="progress-bar" style="width: 80px;">
                    <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: task.progress === 100 ? 'var(--success)' : 'var(--primary)' }"></div>
                  </div>
                  <span class="progress-text">{{ task.progress }}%</span>
                </div>
              </td>
              <td>{{ task.deadline }}</td>
              <td>{{ task.completed_at || '-' }}</td>
              <td>
                <router-link :to="`/admin/task/${task.id}`" class="btn btn-sm">查看</router-link>
                <router-link v-if="canEditTask(task)" :to="`/admin/task/${task.id}`" class="btn btn-sm btn-edit">编辑</router-link>
                <button v-if="canDelete" class="btn btn-sm btn-danger" @click="handleDelete(task.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { taskAPI, userAPI, taskImportAPI, wbsAPI } from '../../api/index.js'
import { taskTypeMap, authStore, canImportTasks } from '../../store/auth.js'

const canDelete = computed(() => {
  const role = authStore.user?.role
  return ['admin', 'leader', 'supervisor'].includes(role)
})

// 编辑入口：仅任务发起人本人（或管理员）可见——谁发起谁修改
function canEditTask(task) {
  const role = authStore.user?.role
  if (role === 'admin') return true
  return Number(task.publisher?.id) === Number(authStore.user?.id)
}

const priorityMap = {
  urgent: { label: '紧急', color: '#ff4d4f', bg: '#fff2f0' },
  high: { label: '重要', color: '#fa8c16', bg: '#fff7e6' },
  normal: { label: '普通', color: '#1677ff', bg: '#e6f4ff' },
  low: { label: '低优', color: '#8c8c8c', bg: '#f5f5f5' }
}

const statusMap = {
  pending: { label: '待开始', color: '#8c8c8c', bg: '#f5f5f5' },
  decomposing: { label: '分解中', color: '#722ed1', bg: '#f9f0ff' },
  in_progress: { label: '进行中', color: '#1677ff', bg: '#e6f4ff' },
  feedback: { label: '反馈中', color: '#13c2c2', bg: '#e6fffb' },
  review: { label: '待审核', color: '#fa8c16', bg: '#fff7e6' },
  completed: { label: '已完成', color: '#52c41a', bg: '#f6ffed' },
  overdue: { label: '已逾期', color: '#ff4d4f', bg: '#fff2f0' }
}

const tasks = ref([])
const loading = ref(true)
const searchText = ref('')
const publisherSearch = ref('')
const filterPublisherId = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const filterType = ref('')

// 项目号(WBS) / 车号 搜索与下拉筛选
const wbsProjectSearch = ref('')
const wbsCarSearch = ref('')
const filterWbsProjectId = ref('')
const filterWbsCarId = ref('')

// 发起人下拉（精确过滤 publisher_id）
const users = ref([])

// WBS 字典（来自「WBS字典维护」维护的项目WBS -> 车号层级）
const wbsProjects = ref([])
const wbsCars = ref([])

// 任务导入（下载模板 / 导入 Excel）
const fileInputRef = ref(null)
const downloading = ref(false)
const importing = ref(false)
const importResult = ref(null)

const importErrors = computed(() => {
  const errors = importResult.value?.errors || []
  // 未使用 dryRun 时，errors 中只有真正的失败行
  return errors.filter(e => !String(e.message || '').startsWith('（校验通过'))
})

const filteredTasks = computed(() => {
  let result = tasks.value
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    result = result.filter(t => t.title?.toLowerCase().includes(kw))
  }
  if (publisherSearch.value) {
    const kw = publisherSearch.value.toLowerCase()
    result = result.filter(t =>
      t.publisher?.name?.toLowerCase().includes(kw) ||
      t.publisher?.username?.toLowerCase().includes(kw)
    )
  }
  if (filterPublisherId.value) {
    result = result.filter(t => Number(t.publisher?.id) === Number(filterPublisherId.value))
  }
  if (wbsProjectSearch.value) {
    const kw = wbsProjectSearch.value.toLowerCase()
    result = result.filter(t => (t.wbsProjectNames || []).some(n => String(n).toLowerCase().includes(kw)))
  }
  if (filterWbsProjectId.value) {
    const pid = Number(filterWbsProjectId.value)
    result = result.filter(t => (t.wbsProjects || []).some(p => Number(p.id) === pid))
  }
  if (wbsCarSearch.value) {
    const kw = wbsCarSearch.value.toLowerCase()
    result = result.filter(t => (t.wbsCarNames || []).some(n => String(n).toLowerCase().includes(kw)))
  }
  if (filterWbsCarId.value) {
    const cid = Number(filterWbsCarId.value)
    result = result.filter(t => (t.wbsCars || []).some(c => Number(c.id) === cid))
  }
  if (filterStatus.value) result = result.filter(t => t.status === filterStatus.value)
  if (filterPriority.value) result = result.filter(t => t.priority === filterPriority.value)
  if (filterType.value) result = result.filter(t => t.task_type === filterType.value)
  return result
})

async function loadTasks() {
  loading.value = true
  try {
    const data = await taskAPI.list()
    tasks.value = data.tasks
  } catch (e) {
    console.error('Failed to load tasks:', e)
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const data = await userAPI.list()
    users.value = data.users || []
  } catch (e) {
    console.error('Failed to load users:', e)
  }
}

// 加载 WBS 字典（项目WBS -> 车号），用于筛选下拉
async function loadWbs() {
  try {
    const data = await wbsAPI.tree()
    const projects = []
    const cars = []
    for (const p of (data.tree || [])) {
      projects.push({ id: p.id, name: p.name || p.code })
      for (const c of (p.children || [])) {
        cars.push({ id: c.id, name: c.name || c.code, projectName: p.name || p.code })
      }
    }
    wbsProjects.value = projects
    wbsCars.value = cars
  } catch (e) {
    console.error('Failed to load WBS dictionary:', e)
  }
}

// 下载导入模板（xlsx，含「任务导入」与「填写说明」两个 sheet）
async function downloadTemplate() {
  downloading.value = true
  try {
    const blob = await taskImportAPI.downloadTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'task-import-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert(e.message || '模板下载失败')
  } finally {
    downloading.value = false
  }
}

function triggerImport() {
  fileInputRef.value?.click()
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  // 允许重复选择同一个文件
  event.target.value = ''
  if (!file) return
  importing.value = true
  importResult.value = null
  try {
    const base64 = await readFileAsBase64(file)
    const result = await taskImportAPI.import(base64)
    importResult.value = result
    await loadTasks()
  } catch (e) {
    alert(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}

function exportExcel() {
  const headers = ['ID', '任务标题', '类型', '优先级', '状态', '发起人', '项目号(WBS)', '车号', '主管', '进度', '截止日期', '实际完成日期']
  const rows = filteredTasks.value.map(t => [
    t.id,
    t.title,
    taskTypeMap[t.task_type]?.label || t.task_type,
    priorityMap[t.priority]?.label,
    statusMap[t.status]?.label,
    t.publisher?.name || '',
    (t.wbsProjectNames || []).join('、'),
    (t.wbsCarNames || []).join('、'),
    t.supervisor?.name || '',
    t.progress + '%',
    t.deadline || '',
    t.completed_at || ''
  ])

  // Build CSV with BOM for Excel compatibility
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '任务管理_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}


async function handleDelete(taskId) {
  if (!confirm('确定要删除此任务吗？此操作不可恢复。')) return
  try {
    await taskAPI.remove(taskId)
    await loadTasks()
  } catch (e) {
    alert(e.message || '删除失败')
  }
}
onMounted(() => {
  loadTasks()
  loadUsers()
  loadWbs()
})
</script>

<style scoped>
.task-list-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: baseline; gap: 12px; background: #fff; color: #000; padding: 16px 16px 20px; border-radius: var(--radius); margin-bottom: 8px; border-bottom: 1px solid var(--border); }
.page-header h2 { font-size: 20px; font-weight: 600; color: #000; margin: 0; }
.summary { font-size: 13px; color: #000; }

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-box {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; flex: 0 1 210px; min-width: 170px; max-width: 360px;
}
.search-box svg { color: var(--text-secondary); flex-shrink: 0; }
.search-input { border: none; outline: none; font-size: 14px; color: var(--text); background: transparent; width: 100%; }
.filter-group { display: flex; gap: 8px; }
.filter-select { width: 140px; }

.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; }
.table-card { overflow: hidden; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 48px; color: var(--text-secondary); font-size: 14px;
}

.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  text-align: left; padding: 12px 14px; color: var(--text-secondary);
  font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; background: #fafbfc;
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f5f7fa; color: var(--text); }
.data-table tbody tr:hover { background: #fafbfc; }
.cell-id { color: var(--text-secondary); font-family: monospace; }
.cell-title { font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-empty { color: var(--text-caption); }
.cell-wbs { max-width: 180px; }
.wbs-tag {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 12px; font-weight: 500; color: var(--primary); background: var(--primary-light, #e6f4ff);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; vertical-align: middle;
}
.wbs-tag-car { color: #52c41a; background: #f6ffed; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.cell-progress { display: flex; align-items: center; gap: 8px; }
.progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;
  text-decoration: none; cursor: pointer; border: 1px solid var(--border);
  background: #fff; color: var(--text); transition: all 0.2s;
}
.btn:hover { border-color: var(--primary); color: var(--primary); }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-edit { color: #1677ff; border-color: #1677ff; }
.btn-danger:hover { background: #ff4d4f; color: #fff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.form-select {
  height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 28px 0 10px; font-size: 13px; color: var(--text);
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer; outline: none;
}
.form-select:focus { border-color: var(--primary); }
.btn-export {
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid #52c41a; background: #f6ffed; color: #52c41a;
  transition: all 0.2s; white-space: nowrap;
}
.btn-export:hover { background: #52c41a; color: #fff; }

.btn-template {
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--primary); background: #e6f4ff; color: var(--primary);
  transition: all 0.2s; white-space: nowrap;
}
.btn-template:hover { background: var(--primary); color: #fff; }
.btn-template:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-template:disabled:hover { background: #e6f4ff; color: var(--primary); }
.file-input { display: none; }

.import-panel {
  background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.import-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.import-panel-head strong { font-size: 14px; color: var(--text); }
.import-summary { margin: 0; font-size: 13px; color: var(--text); }
.import-summary .ok { color: #52c41a; }
.import-summary .fail { color: #ff4d4f; }
.import-batch { margin-left: 12px; font-size: 12px; color: var(--text-secondary); }
.import-errors { margin-top: 12px; }
.import-errors-title { font-size: 13px; font-weight: 500; color: #ff4d4f; margin-bottom: 6px; }
.import-errors ul { margin: 0; padding-left: 18px; max-height: 240px; overflow-y: auto; }
.import-errors li { font-size: 12px; color: var(--text); line-height: 1.8; }
.import-errors .err-row { color: #ff4d4f; margin-right: 8px; white-space: nowrap; }
.import-all-ok { margin: 12px 0 0; font-size: 13px; color: #52c41a; }
</style>


