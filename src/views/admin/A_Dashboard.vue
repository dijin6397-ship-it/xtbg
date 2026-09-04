<template>
  <div class="dashboard">
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>欢迎回来，{{ authStore.user?.name }}</h2>
        <p>{{ roleMap[authStore.user?.role] }} · {{ authStore.user?.department || '技术质量部' }}</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card stat-total">
        <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">任务总数</div></div>
      </div>
      <div class="stat-card stat-active">
        <div class="stat-icon cyan"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#13c2c2" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.active }}</div><div class="stat-label">进行中</div></div>
      </div>
      <div class="stat-card stat-overdue">
        <div class="stat-icon red"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.overdue }}</div><div class="stat-label">已逾期</div></div>
      </div>
      <div class="stat-card stat-complete">
        <div class="stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.completed }}</div><div class="stat-label">已完成</div></div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">我的待办任务</h3>
      <div v-if="myTasks.length === 0" class="empty-state">暂无待办任务</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>任务名称</th>
              <th>类型</th>
              <th>优先级</th>
              <th>状态</th>
              <th>进度</th>
              <th>截止日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in myTasks" :key="task.id" class="clickable-row" @click="$router.push(`/admin/task/${task.id}`)">
              <td class="cell-title">{{ task.title }}</td>
              <td>
                <span class="tag" :style="{ color: taskTypeMap[task.task_type]?.color, background: taskTypeMap[task.task_type]?.bg }">
                  {{ taskTypeMap[task.task_type]?.label }}
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
              <td>
                <div class="cell-progress">
                  <div class="progress-bar" style="width: 80px;"><div class="progress-bar-fill" :style="{ width: task.progress + '%', background: task.progress === 100 ? 'var(--success)' : 'var(--primary)' }"></div></div>
                  <span class="progress-text">{{ task.progress }}%</span>
                </div>
              </td>
              <td>{{ task.deadline }}</td>
              <td><router-link :to="`/admin/task/${task.id}`" class="btn btn-sm" @click.stop>查看</router-link></td>
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
import { authStore, roleMap, taskTypeMap } from '../../store/auth.js'

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

const stats = ref({ total: 0, active: 0, overdue: 0, completed: 0, pending: 0, review: 0 })
const allTasks = ref([])

const myTasks = computed(() => {
  const uid = authStore.user?.id
  return allTasks.value.filter(t => {
    return t.publisher_id === uid || t.supervisor_id === uid ||
      t.assignees?.some(a => a.id === uid) ||
      t.subtasks?.some(s => s.assignee?.id === uid)
  }).slice(0, 10)
})

async function loadData() {
  try {
    const [statsData, tasksData] = await Promise.all([
      taskAPI.stats(),
      taskAPI.list()
    ])
    stats.value = statsData
    allTasks.value = tasksData.tasks
  } catch (e) {
    console.error('Dashboard load error:', e)
  }
}

onMounted(loadData)
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 24px; }

.welcome-banner {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  border-radius: var(--radius); padding: 24px 28px; color: #fff;
}
.welcome-text h2 { font-size: 20px; font-weight: 600; margin: 0 0 4px 0; }
.welcome-text p { font-size: 14px; opacity: 0.85; margin: 0; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-card {
  background: #fff; border-radius: var(--radius); padding: 20px;
  display: flex; align-items: center; gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.stat-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--primary-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.stat-icon.cyan { background: #e6fffb; }
.stat-icon.red { background: #fff2f0; }
.stat-icon.green { background: #f6ffed; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--text); line-height: 1.2; }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.card { background: #fff; border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.card-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px 0; }
.empty-state { text-align: center; padding: 24px; color: var(--text-secondary); font-size: 13px; }

.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { text-align: left; padding: 10px 12px; color: var(--text-secondary); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table td { padding: 12px; border-bottom: 1px solid #f5f7fa; color: var(--text); }
.clickable-row { cursor: pointer; transition: background 0.15s; }
.clickable-row:hover { background: #fafbfc; }
.cell-title { font-weight: 500; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.cell-progress { display: flex; align-items: center; gap: 8px; }
.progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: var(--text-secondary); }

.btn { display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; text-decoration: none; cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); transition: all 0.2s; }
.btn:hover { border-color: var(--primary); color: var(--primary); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

@media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .stats-row { grid-template-columns: 1fr; } }
</style>
