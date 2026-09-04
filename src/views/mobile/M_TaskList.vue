<template>
  <div class="page">
    <div class="page-header">
      <h1>任务列表</h1>
      <p>共 {{ filteredTasks.length }} 项任务</p>
    </div>

    <!-- Status Filter -->
    <div class="filter-tabs">
      <span
        v-for="f in statusFilters"
        :key="f.key"
        class="filter-tab"
        :class="{ active: activeStatus === f.key }"
        @click="activeStatus = f.key"
      >{{ f.label }}</span>
    </div>

    <!-- Priority Filter -->
    <div class="filter-tabs" style="padding-top: 0">
      <span
        v-for="p in priorityFilters"
        :key="p.key"
        class="filter-tab"
        :class="{ active: activePriority === p.key }"
        @click="activePriority = p.key"
      >{{ p.label }}</span>
    </div>

    <!-- Task List -->
    <div
      v-for="t in filteredTasks"
      :key="t.id"
      class="card m-task-card"
      @click="goDetail(t.id)"
    >
      <div class="m-task-card-header">
        <span class="tag" :style="{ background: getPriority(t).bg, color: getPriority(t).color }">{{ getPriority(t).label }}</span>
        <span class="tag" :style="{ background: getStatus(t).bg, color: getStatus(t).color }">{{ getStatus(t).label }}</span>
      </div>
      <h3 class="m-task-card-title">{{ t.title }}</h3>
      <p class="m-task-card-desc">{{ t.description }}</p>
      <div class="progress-bar" style="margin-bottom:10px">
        <div class="progress-bar-fill" :style="{ width: t.progress + '%', background: progressColor(t.progress) }"></div>
      </div>
      <div class="m-task-card-footer">
        <div class="m-task-card-user">
          <div class="avatar" :style="{ background: avatarColor(t.publisher.name), width: '24px', height: '24px', fontSize: '10px' }">{{ t.publisher.name[0] }}</div>
          <span>{{ t.publisher.name }}</span>
        </div>
        <div class="m-task-card-meta">
          <span v-if="t.urgCount > 0" class="m-urge-count">{{ t.urgCount }}次催办</span>
          <span class="m-deadline">{{ t.deadline }}</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!filteredTasks.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>暂无匹配的任务</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { store, priorityMap, statusMap } from '../../store/tasks.js'

const router = useRouter()
const goDetail = id => router.push(`/m/task/${id}`)

const activeStatus = ref('all')
const activePriority = ref('all')

function getPriority(task) { return priorityMap[task.priority] || {} }
function getStatus(task) { return statusMap[task.status] || {} }

function progressColor(p) {
  if (p >= 80) return '#52c41a'
  if (p >= 50) return '#1677ff'
  if (p >= 20) return '#fa8c16'
  return '#ff4d4f'
}

function avatarColor(name) {
  const colors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const statusFilters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待开始' },
  { key: 'decomposing', label: '分解中' },
  { key: 'in_progress', label: '进行中' },
  { key: 'feedback', label: '反馈中' },
  { key: 'review', label: '待验收' },
  { key: 'overdue', label: '已逾期' },
  { key: 'completed', label: '已完成' }
]

const priorityFilters = [
  { key: 'all', label: '全部' },
  { key: 'urgent', label: '紧急' },
  { key: 'high', label: '重要' },
  { key: 'normal', label: '普通' }
]

const filteredTasks = computed(() => {
  return store.tasks.filter(t => {
    if (activeStatus.value !== 'all' && t.status !== activeStatus.value) return false
    if (activePriority.value !== 'all' && t.priority !== activePriority.value) return false
    return true
  })
})
</script>

<style scoped>
.m-task-card {
  cursor: pointer;
}
.m-task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.m-task-card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  line-height: 1.4;
}
.m-task-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.m-task-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.m-task-card-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.m-task-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-urge-count {
  font-size: 11px;
  color: var(--danger);
}
.m-deadline {
  font-size: 11px;
  color: var(--text-caption);
}
</style>
