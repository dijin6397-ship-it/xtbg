<template>
  <div class="page">
    <div class="page-header" style="padding-bottom: 16px">
      <div class="m-back-row" @click="$router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style="font-size: 13px">返回</span>
      </div>
      <h1 style="font-size: 17px; line-height: 1.4">报表统计</h1>
      <p style="font-size: 12px; opacity: 0.85; margin-top: 4px">按人员、分类、时间等维度查询</p>
    </div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">人员</label>
        <select v-model="filters.userId" class="form-select-m">
          <option value="">全部人员</option>
          <option v-for="u in userOptions" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">一级分类</label>
        <select v-model="filters.l1" class="form-select-m" @change="onL1Change">
          <option value="">全部一级</option>
          <option v-for="c in l1Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">二级分类</label>
        <select v-model="filters.l2" class="form-select-m" :disabled="!filters.l1" @change="onL2Change">
          <option value="">全部二级</option>
          <option v-for="c in l2Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">三级分类</label>
        <select v-model="filters.l3" class="form-select-m" :disabled="!filters.l2">
          <option value="">全部三级</option>
          <option v-for="c in l3Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">开始日期</label>
          <input v-model="filters.startDate" type="date" class="form-input-m" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">结束日期</label>
          <input v-model="filters.endDate" type="date" class="form-input-m" />
        </div>
      </div>
      <div style="display: flex; gap: 8px">
        <button class="btn btn-primary" style="flex:1" @click="loadReport" :disabled="loading">{{ loading ? '查询中...' : '查询' }}</button>
        <button class="btn" style="flex:1" @click="resetFilters">重置</button>
      </div>
    </div>

    <div class="card summary-card">
      <div style="display: flex; justify-content: space-around; text-align: center">
        <div>
          <div style="font-size: 22px; font-weight: 700; color: #fff">{{ summary.totalCount }}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.85)">输出物数</div>
        </div>
        <div>
          <div style="font-size: 22px; font-weight: 700; color: #fff">{{ summary.grandTotal }}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.85)">总分合计</div>
        </div>
        <div>
          <div style="font-size: 22px; font-weight: 700; color: #fff">{{ summary.approvedCount }}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.85)">已通过</div>
        </div>
      </div>
    </div>

    <div class="card" v-if="summary.byUser.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">按人员统计</div>
      <div v-for="(r, i) in summary.byUser" :key="i" class="m-stat-row">
        <span style="font-size: 13px">{{ r.userName }} ({{ r.count }})</span>
        <strong style="color: var(--primary)">{{ formatScore(r.total) }}</strong>
      </div>
    </div>

    <div class="card" v-if="rows.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">明细 ({{ rows.length }})</div>
      <div v-for="r in rows" :key="r.id" class="m-row-item">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
          <span style="font-size: 13px; font-weight: 500">{{ r.userName }}</span>
          <span class="tag" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
        </div>
        <div v-if="r.taskTitle" style="font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px">{{ r.taskTitle }}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 12px; color: var(--text-caption); margin-bottom: 4px">
          <span v-if="r.taskType" class="tag tag-sm" :class="typeTagClass(r.taskType)">{{ typeLabel(r.taskType) }}</span>
          <span v-if="r.taskStatus" class="tag tag-sm" :class="taskStatusClass(r.taskStatus)">{{ taskStatusLabel(r.taskStatus) }}</span>
          <span v-if="r.supervisorName">主管：{{ r.supervisorName }}</span>
        </div>
        <div v-if="r.taskCreatedAt || r.taskDeadline" style="font-size: 12px; color: var(--text-caption); margin-bottom: 4px">
          <span>开始：{{ r.taskCreatedAt || '—' }}</span>
          <span style="margin: 0 6px">|</span>
          <span :style="{ color: r.taskStatus !== 'completed' && r.taskDeadline && new Date(r.taskDeadline) < new Date() ? '#ff4d4f' : 'inherit' }">截止：{{ r.taskDeadline || '—' }}</span>
        </div>
        <div style="font-size: 12px; color: var(--primary); margin-bottom: 4px">{{ r.categoryL1Name }} / {{ r.categoryL2Name }} / {{ r.categoryL3Name }}</div>
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px">{{ r.content }}</div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-caption)">
          <span>{{ r.scoreValue }} × {{ r.scoreQuantity }} = <strong style="color: var(--primary)">{{ r.scoreTotal }}</strong></span>
          <span>{{ r.createdAt }}</span>
        </div>
      </div>
    </div>

    <div v-if="!loading && rows.length === 0" class="card" style="text-align: center; color: var(--text-caption); font-size: 13px; padding: 32px">
      暂无数据
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { dictionaryAPI, userAPI } from '../../api/index.js'
import { taskTypeMap, statusMap } from '../../store/auth.js'

const filters = reactive({ userId: '', l1: '', l2: '', l3: '', startDate: '', endDate: '' })
const userOptions = ref([])
const l1Options = ref([])
const l2Options = ref([])
const l3Options = ref([])
const allCategories = ref([])
const rows = ref([])
const summary = ref({ totalCount: 0, grandTotal: 0, byUser: [], approvedCount: 0 })
const loading = ref(false)

async function loadUsers() {
  try { const data = await userAPI.list(); userOptions.value = data.users || [] } catch (e) {}
}
async function loadCategories() {
  try { const data = await dictionaryAPI.list(); allCategories.value = data.categories || []; l1Options.value = allCategories.value.filter(c => c.level === 1 && c.active) } catch (e) {}
}
function onL1Change() { filters.l2 = ''; filters.l3 = ''; l2Options.value = allCategories.value.filter(c => c.level === 2 && c.parentId === Number(filters.l1) && c.active); l3Options.value = [] }
function onL2Change() { filters.l3 = ''; l3Options.value = allCategories.value.filter(c => c.level === 3 && c.parentId === Number(filters.l2) && c.active) }
function statusClass(s) { return { pending: 'tag-warning', approved: 'tag-success', rejected: 'tag-danger' }[s] || 'tag-default' }
function statusLabel(s) { return { pending: '待审核', approved: '已通过', rejected: '已退回' }[s] || s }
function formatScore(v) { return Math.round((v || 0) * 100) / 100 }

function typeLabel(t) { return taskTypeMap[t]?.label || t || '' }
function typeTagClass(t) {
  return {
    self_repair: 'tag-type-self_repair',
    rectification: 'tag-type-rectification',
    quality_analysis: 'tag-type-quality_analysis',
    key_work: 'tag-type-key_work',
    daily_management: 'tag-type-daily_management'
  }[t] || 'tag-default'
}
function taskStatusLabel(s) { return statusMap[s]?.label || s || '' }
function taskStatusClass(s) {
  return {
    pending: 'tag-default',
    decomposing: 'tag-type-quality_analysis',
    in_progress: 'tag-type-self_repair',
    feedback: 'tag-type-key_work',
    review: 'tag-warning',
    completed: 'tag-success',
    overdue: 'tag-danger',
    cancelled: 'tag-default'
  }[s] || 'tag-default'
}
function resetFilters() { filters.userId = ''; filters.l1 = ''; filters.l2 = ''; filters.l3 = ''; filters.startDate = ''; filters.endDate = ''; l2Options.value = []; l3Options.value = []; loadReport() }

async function loadReport() {
  loading.value = true
  try {
    const params = {}
    if (filters.userId) params.user_id = filters.userId
    if (filters.l1) params.l1 = filters.l1
    if (filters.l2) params.l2 = filters.l2
    if (filters.l3) params.l3 = filters.l3
    if (filters.startDate) params.start_date = filters.startDate
    if (filters.endDate) params.end_date = filters.endDate
    const data = await dictionaryAPI.report(params)
    rows.value = data.rows || []
    summary.value = {
      totalCount: rows.value.length,
      grandTotal: data.summary?.grandTotal || 0,
      byUser: data.summary?.byUser || [],
      approvedCount: rows.value.filter(r => r.status === 'approved').length
    }
  } catch (e) { alert(e.message) } finally { loading.value = false }
}

onMounted(async () => { await Promise.all([loadUsers(), loadCategories()]); await loadReport() })
</script>

<style scoped>
.m-back-row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; cursor: pointer; }
.form-group { margin-bottom: 12px; }
.form-label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--text-secondary); }
.form-row { display: flex; gap: 8px; }

.form-input-m, .form-select-m {
  width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 12px; font-size: 13px; box-sizing: border-box; background: #fff; outline: none;
}
.form-select-m {
  padding: 0 28px 0 10px;
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer;
}
.form-select-m:disabled { background-color: #f5f5f5; cursor: not-allowed; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.tag-sm { font-size: 11px; padding: 1px 6px; }
.tag-success { color: #52c41a; background: #f6ffed; }
.tag-warning { color: #fa8c16; background: #fff7e6; }
.tag-danger { color: #ff4d4f; background: #fff2f0; }
.tag-default { color: #8c8c8c; background: #f5f5f5; }
.tag-type-self_repair { color: #1677ff; background: #e6f4ff; }
.tag-type-rectification { color: #fa8c16; background: #fff7e6; }
.tag-type-quality_analysis { color: #722ed1; background: #f9f0ff; }
.tag-type-key_work { color: #13c2c2; background: #e6fffb; }
.tag-type-daily_management { color: #faad14; background: #fffbe6; }

.m-stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f0f0f0; }
.m-stat-row:last-child { border-bottom: none; }
.m-row-item { padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.m-row-item:last-child { border-bottom: none; }

.summary-card { background: var(--primary); border-radius: var(--radius); }
</style>
