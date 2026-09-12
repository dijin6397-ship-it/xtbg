<template>
  <div class="report-page">
    <h2 class="page-title">报表统计</h2>
    <p class="page-desc">按人员、一/二/三级分类、输出物、时间跨度等维度查询与统计</p>

    <!-- Filters -->
    <div class="card filter-card">
      <div class="filter-grid">
        <div class="filter-item">
          <label class="filter-label">人员</label>
          <select v-model="filters.userId" class="form-select">
            <option value="">全部人员</option>
            <option v-for="u in userOptions" :key="u.id" :value="u.id">{{ u.name }}{{ u.department ? ' (' + u.department + ')' : '' }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">一级分类</label>
          <select v-model="filters.l1" class="form-select" @change="onL1Change">
            <option value="">全部一级</option>
            <option v-for="c in l1Options" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">二级分类</label>
          <select v-model="filters.l2" class="form-select" :disabled="!filters.l1" @change="onL2Change">
            <option value="">全部二级</option>
            <option v-for="c in l2Options" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">三级分类</label>
          <select v-model="filters.l3" class="form-select" :disabled="!filters.l2">
            <option value="">全部三级</option>
            <option v-for="c in l3Options" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">输出物关键字</label>
          <input v-model="filters.keyword" class="form-input" placeholder="按输出物内容搜索" />
        </div>
        <div class="filter-item">
          <label class="filter-label">状态</label>
          <select v-model="filters.status" class="form-select">
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已退回</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">开始日期</label>
          <input v-model="filters.startDate" type="date" class="form-input" />
        </div>
        <div class="filter-item">
          <label class="filter-label">结束日期</label>
          <input v-model="filters.endDate" type="date" class="form-input" />
        </div>
        <div class="filter-item filter-actions">
          <button class="btn btn-primary" @click="loadReport" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
          <button class="btn" @click="resetFilters">重置</button>
          <button class="btn btn-export" @click="exportExcel">📊 导出Excel</button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="card summary-card">
        <div class="summary-value">{{ summary.totalCount }}</div>
        <div class="summary-label">输出物总数</div>
      </div>
      <div class="card summary-card">
        <div class="summary-value">{{ summary.grandTotal }}</div>
        <div class="summary-label">总分合计</div>
      </div>
      <div class="card summary-card">
        <div class="summary-value">{{ summary.approvedCount }}</div>
        <div class="summary-label">已通过</div>
      </div>
      <div class="card summary-card">
        <div class="summary-value">{{ summary.pendingCount }}</div>
        <div class="summary-label">待审核</div>
      </div>
    </div>

    <!-- Aggregations -->
    <div class="agg-grid" v-if="summary.byUser.length || summary.byL1.length">
      <div class="card agg-card" v-if="summary.byUser.length">
        <h3 class="agg-title">按人员统计</h3>
        <table class="agg-table">
          <thead><tr><th>人员</th><th>输出物数</th><th>总分</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in summary.byUser" :key="i">
              <td>{{ r.userName }}</td>
              <td>{{ r.count }}</td>
              <td><strong>{{ formatScore(r.total) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card agg-card" v-if="summary.byL1.length">
        <h3 class="agg-title">按一级分类统计</h3>
        <table class="agg-table">
          <thead><tr><th>一级分类</th><th>输出物数</th><th>总分</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in summary.byL1" :key="i">
              <td>{{ r.name }}</td>
              <td>{{ r.count }}</td>
              <td><strong>{{ formatScore(r.total) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card agg-card" v-if="summary.byL3.length">
        <h3 class="agg-title">按三级分类统计</h3>
        <table class="agg-table">
          <thead><tr><th>三级分类</th><th>输出物数</th><th>总分</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in summary.byL3" :key="i">
              <td>{{ r.name }}</td>
              <td>{{ r.count }}</td>
              <td><strong>{{ formatScore(r.total) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Table -->
    <div class="card table-card">
      <div class="table-header">
        <h3>明细列表 ({{ rows.length }})</h3>
      </div>
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="rows.length === 0" class="empty-state">
        <p>未找到匹配的输出物</p>
      </div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>任务标题</th>
              <th>类型</th>
              <th>开始时间</th>
              <th>截至日期</th>
              <th>状态</th>
              <th>主管</th>
              <th>提交人</th>
              <th>部门</th>
              <th>一级</th>
              <th>二级</th>
              <th>三级</th>
              <th>输出物</th>
              <th>分数</th>
              <th>数量</th>
              <th>总分</th>
              <th>输出状态</th>
              <th>提交时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td class="cell-id">#{{ r.id }}</td>
              <td class="cell-title">{{ r.taskTitle || '—' }}</td>
              <td>
                <span v-if="r.taskType" class="tag" :class="typeTagClass(r.taskType)">{{ typeLabel(r.taskType) }}</span>
                <span v-else>—</span>
              </td>
              <td>{{ r.taskCreatedAt || '—' }}</td>
              <td :class="{ 'cell-overdue': r.taskStatus !== 'completed' && r.taskDeadline && new Date(r.taskDeadline) < new Date() }">{{ r.taskDeadline || '—' }}</td>
              <td>
                <span v-if="r.taskStatus" class="tag" :class="taskStatusClass(r.taskStatus)">{{ taskStatusLabel(r.taskStatus) }}</span>
                <span v-else>—</span>
              </td>
              <td>{{ r.supervisorName || '—' }}</td>
              <td>{{ r.userName }}</td>
              <td>{{ r.department }}</td>
              <td>{{ r.categoryL1Name || '—' }}</td>
              <td>{{ r.categoryL2Name || '—' }}</td>
              <td>{{ r.categoryL3Name || '—' }}</td>
              <td class="cell-content">{{ r.content }}</td>
              <td>{{ r.scoreValue > 0 ? r.scoreValue : '—' }}</td>
              <td>{{ r.scoreQuantity > 0 ? r.scoreQuantity : '—' }}</td>
              <td><strong>{{ r.scoreTotal > 0 ? r.scoreTotal : '—' }}</strong></td>
              <td>
                <span class="tag" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
              </td>
              <td>{{ r.createdAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { dictionaryAPI } from '../../api/index.js'
import { userAPI } from '../../api/index.js'
import { taskTypeMap, statusMap } from '../../store/auth.js'

const filters = reactive({
  userId: '',
  l1: '',
  l2: '',
  l3: '',
  keyword: '',
  status: '',
  startDate: '',
  endDate: ''
})

const userOptions = ref([])
const l1Options = ref([])
const l2Options = ref([])
const l3Options = ref([])
const allCategories = ref([])

const rows = ref([])
const summary = ref({ totalCount: 0, grandTotal: 0, byUser: [], byL1: [], byL3: [], approvedCount: 0, pendingCount: 0 })
const loading = ref(false)

async function loadUsers() {
  try {
    const data = await userAPI.list()
    userOptions.value = data.users || []
  } catch (e) { console.error('loadUsers:', e) }
}

async function loadCategories() {
  try {
    const data = await dictionaryAPI.list()
    allCategories.value = data.categories || []
    l1Options.value = allCategories.value.filter(c => c.level === 1 && c.active)
  } catch (e) { console.error('loadCategories:', e) }
}

function onL1Change() {
  filters.l2 = ''
  filters.l3 = ''
  l2Options.value = allCategories.value.filter(c => c.level === 2 && c.parentId === Number(filters.l1) && c.active)
  l3Options.value = []
}
function onL2Change() {
  filters.l3 = ''
  l3Options.value = allCategories.value.filter(c => c.level === 3 && c.parentId === Number(filters.l2) && c.active)
}

function statusClass(s) {
  return { pending: 'tag-warning', approved: 'tag-success', rejected: 'tag-danger' }[s] || 'tag-default'
}
function statusLabel(s) {
  return { pending: '待审核', approved: '已通过', rejected: '已退回' }[s] || s
}
function formatScore(v) {
  return Math.round((v || 0) * 100) / 100
}

// Task type display
function typeLabel(t) {
  return taskTypeMap[t]?.label || t || ''
}
function typeTagClass(t) {
  const map = {
    self_repair: 'tag-type-self_repair',
    rectification: 'tag-type-rectification',
    quality_analysis: 'tag-type-quality_analysis',
    key_work: 'tag-type-key_work',
    daily_management: 'tag-type-daily_management'
  }
  return map[t] || 'tag-default'
}

// Task status display
function taskStatusLabel(s) {
  return statusMap[s]?.label || s || ''
}
function taskStatusClass(s) {
  const map = {
    pending: 'tag-default',
    decomposing: 'tag-type-quality_analysis',
    in_progress: 'tag-type-self_repair',
    feedback: 'tag-type-key_work',
    review: 'tag-warning',
    completed: 'tag-success',
    overdue: 'tag-danger',
    cancelled: 'tag-default'
  }
  return map[s] || 'tag-default'
}

function resetFilters() {
  filters.userId = ''
  filters.l1 = ''
  filters.l2 = ''
  filters.l3 = ''
  filters.keyword = ''
  filters.status = ''
  filters.startDate = ''
  filters.endDate = ''
  l2Options.value = []
  l3Options.value = []
  loadReport()
}

async function loadReport() {
  loading.value = true
  try {
    const params = {}
    if (filters.userId) params.user_id = filters.userId
    if (filters.l1) params.l1 = filters.l1
    if (filters.l2) params.l2 = filters.l2
    if (filters.l3) params.l3 = filters.l3
    if (filters.status) params.status = filters.status
    if (filters.startDate) params.start_date = filters.startDate
    if (filters.endDate) params.end_date = filters.endDate
    const data = await dictionaryAPI.report(params)
    let detailRows = data.rows || []
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      detailRows = detailRows.filter(r => (r.content || '').toLowerCase().includes(kw))
    }
    rows.value = detailRows
    const approvedCount = detailRows.filter(r => r.status === 'approved').length
    const pendingCount = detailRows.filter(r => r.status === 'pending').length
    summary.value = {
      totalCount: detailRows.length,
      grandTotal: data.summary?.grandTotal || 0,
      byUser: data.summary?.byUser || [],
      byL1: data.summary?.byL1 || [],
      byL3: data.summary?.byL3 || [],
      approvedCount,
      pendingCount
    }
  } catch (e) {
    console.error('loadReport:', e)
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function exportExcel() {
  const headers = ['ID', '任务标题', '类型', '开始时间', '截至日期', '状态', '主管', '提交人', '部门', '一级分类', '二级分类', '三级分类', '输出物', '分数', '数量', '总分', '输出状态', '提交时间']
  const data = rows.value.map(r => [
    r.id, r.taskTitle || '', typeLabel(r.taskType), r.taskCreatedAt || '', r.taskDeadline || '',
    taskStatusLabel(r.taskStatus), r.supervisorName || '',
    r.userName || '', r.department || '',
    r.categoryL1Name || '', r.categoryL2Name || '', r.categoryL3Name || '',
    r.content || '',
    r.scoreValue > 0 ? r.scoreValue : '',
    r.scoreQuantity > 0 ? r.scoreQuantity : '',
    r.scoreTotal > 0 ? r.scoreTotal : '',
    statusLabel(r.status),
    r.createdAt || ''
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...data.map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '输出物报表_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadCategories()])
  await loadReport()
})
</script>

<style scoped>
.report-page { display: flex; flex-direction: column; gap: 20px; max-width: 1400px; }
.page-title { font-size: 20px; font-weight: 600; color: var(--text); margin: 0; }
.page-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 4px 0; }

.card { background: #fff; border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }

.filter-card { padding: 16px 20px; }
.filter-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 16px; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.filter-actions { grid-column: span 4; display: flex; gap: 8px; justify-content: flex-end; }

.form-input, .form-select {
  width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 12px; font-size: 13px; color: var(--text); box-sizing: border-box; outline: none; background: #fff;
}
.form-select {
  padding: 0 28px 0 10px;
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer;
}
.form-select:disabled { background-color: #f5f5f5; cursor: not-allowed; }
.form-input:focus, .form-select:focus { border-color: var(--primary); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
  transition: all 0.2s;
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-export {
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid #52c41a; background: #f6ffed; color: #52c41a;
  transition: all 0.2s;
}
.btn-export:hover { background: #52c41a; color: #fff; }

.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.summary-card { text-align: center; padding: 20px; background: var(--primary); border-radius: var(--radius); }
.summary-value { font-size: 28px; font-weight: 700; color: #fff; }
.summary-label { font-size: 13px; color: rgba(255,255,255,0.85); margin-top: 4px; }

.agg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.agg-card { padding: 16px 20px; }
.agg-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 0 0 12px 0; }
.agg-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.agg-table th, .agg-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f5f5f5; }
.agg-table th { color: var(--text-secondary); font-weight: 500; background: #fafbfc; }

.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.table-header h3 { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1900px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f5f7fa; white-space: nowrap; }
.data-table th { background: #fafbfc; color: var(--text-secondary); font-weight: 500; }
.data-table tbody tr:hover { background: #fafbfc; }
.cell-id { color: var(--text-secondary); font-family: monospace; }
.cell-title { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-content { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-overdue { color: #ff4d4f !important; font-weight: 600; }

.tag-type-self_repair { color: #1677ff; background: #e6f4ff; }
.tag-type-rectification { color: #fa8c16; background: #fff7e6; }
.tag-type-quality_analysis { color: #722ed1; background: #f9f0ff; }
.tag-type-key_work { color: #13c2c2; background: #e6fffb; }
.tag-type-daily_management { color: #faad14; background: #fffbe6; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-success { color: #52c41a; background: #f6ffed; }
.tag-warning { color: #fa8c16; background: #fff7e6; }
.tag-danger { color: #ff4d4f; background: #fff2f0; }
.tag-default { color: #8c8c8c; background: #f5f5f5; }

.loading-state, .empty-state { padding: 40px; text-align: center; color: var(--text-secondary); font-size: 14px; }

@media (max-width: 1024px) {
  .filter-grid { grid-template-columns: repeat(2, 1fr); }
  .filter-actions { grid-column: span 2; }
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
