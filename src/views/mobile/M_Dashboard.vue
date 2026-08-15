<template>
  <div class="page">
    <div class="page-header">
      <h1>欢迎回来</h1>
      <p>{{ today }} · 有 {{ urgentCount }} 项紧急任务待处理</p>
    </div>

    <!-- Stats Grid -->
    <div class="m-stats-grid">
      <div v-for="s in stats" :key="s.label" class="card m-stat-card">
        <div class="m-stat-num" :style="{ color: s.color }">{{ s.count }}</div>
        <div class="m-stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Urgent Tasks -->
    <div v-if="urgentTasks.length" class="m-section">
      <h2 class="m-section-title">紧急任务</h2>
      <div
        v-for="t in urgentTasks"
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
    </div>

    <!-- Recent Tasks -->
    <div class="m-section">
      <h2 class="m-section-title">最近任务</h2>
      <div
        v-for="t in recentTasks"
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
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { store, priorityMap, statusMap } from '../../store/tasks.js'

const router = useRouter()
const goDetail = id => router.push(`/m/task/${id}`)

const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

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

const stats = computed(() => [
  { label: '待处理', count: store.tasks.filter(t => t.status === 'pending').length, color: '#8c8c8c' },
  { label: '进行中', count: store.tasks.filter(t => t.status === 'in_progress').length, color: '#1677ff' },
  { label: '已逾期', count: store.tasks.filter(t => t.status === 'overdue').length, color: '#ff4d4f' },
  { label: '已完成', count: store.tasks.filter(t => t.status === 'completed').length, color: '#52c41a' }
])

const urgentCount = computed(() => store.tasks.filter(t => t.status === 'overdue' || t.priority === 'urgent').length)
const urgentTasks = computed(() => store.tasks.filter(t => t.priority === 'urgent' || t.status === 'overdue').slice(0, 3))
const recentTasks = computed(() => [...store.tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4))
</script>

<style scoped>
.m-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px 16px;
}
.m-stat-card {
  margin: 0;
  text-align: center;
  padding: 12px 8px !important;
}
.m-stat-num {
  font-size: 22px;
  font-weight: 700;
}
.m-stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.m-section {
  padding: 0 0 4px;
}
.m-section-title {
  font-size: 15px;
  font-weight: 600;
  padding: 0 16px;
  margin-bottom: 8px;
}
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
