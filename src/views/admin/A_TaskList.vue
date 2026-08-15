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
      <button class="btn btn-export" @click="exportExcel">📊 导出Excel</button>
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
                <router-link v-if="canEdit" :to="`/admin/task/${task.id}`" class="btn btn-sm btn-edit">编辑</router-link>
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
import { taskAPI } from '../../api/index.js'
import { taskTypeMap, authStore } from '../../store/auth.js'

const canEdit = computed(() => {
  const role = authStore.user?.role
  return ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'].includes(role)
})
const canDelete = canEdit

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
const filterStatus = ref('')
const filterPriority = ref('')
const filterType = ref('')

const filteredTasks = computed(() => {
  let result = tasks.value
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    result = result.filter(t => t.title?.toLowerCase().includes(kw))
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

function exportExcel() {
  const headers = ['ID', '任务标题', '类型', '优先级', '状态', '发起人', '主管', '进度', '截止日期', '实际完成日期']
  const rows = filteredTasks.value.map(t => [
    t.id,
    t.title,
    taskTypeMap[t.task_type]?.label || t.task_type,
    priorityMap[t.priority]?.label,
    statusMap[t.status]?.label,
    t.publisher?.name || '',
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
onMounted(loadTasks)
</script>

<style scoped>
.task-list-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: baseline; gap: 12px; }
.page-header h2 { font-size: 20px; font-weight: 600; color: var(--text); margin: 0; }
.summary { font-size: 13px; color: var(--text-secondary); }

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-box {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; flex: 1; max-width: 360px;
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
</style>


