<template>
  <div class="page">
    <div class="page-header">
      <h1>督办中心</h1>
      <p>任务督办与催办管理</p>
    </div>

    <!-- Stats -->
    <div class="m-stats-grid">
      <div class="card m-stat-card">
        <div class="m-stat-num" style="color: var(--danger)">{{ overdueTasks.length }}</div>
        <div class="m-stat-label">已逾期</div>
      </div>
      <div class="card m-stat-card">
        <div class="m-stat-num" style="color: var(--warning)">{{ highUrgTasks.length }}</div>
        <div class="m-stat-label">催办>3次</div>
      </div>
      <div class="card m-stat-card">
        <div class="m-stat-num" style="color: #722ed1">{{ escalatedCount }}</div>
        <div class="m-stat-label">已升级</div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <span
        v-for="f in filters"
        :key="f.key"
        class="filter-tab"
        :class="{ active: activeTab === f.key }"
        @click="activeTab = f.key"
      >{{ f.label }}</span>
    </div>

    <!-- Supervision Logs -->
    <div v-if="activeTab !== 'overdue'">
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="card supervision-card"
        :class="log.type"
        style="cursor: pointer"
        @click="goTask(log.taskId)"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
          <span class="tag" :style="logTypeStyle(log.type)">{{ logTypeLabel(log.type) }}</span>
          <span style="font-size: 11px; color: var(--text-caption)">{{ log.time }}</span>
        </div>
        <p style="font-size: 13px; margin-bottom: 8px; line-height: 1.5">{{ log.content }}</p>
        <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-secondary)">
          <span>操作人: {{ log.operator.name }}</span>
          <span>-></span>
          <span>责任人: {{ log.target.name }}</span>
        </div>
      </div>

      <div v-if="activeTab !== 'overdue' && !filteredLogs.length" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>暂无督办记录</p>
      </div>
    </div>

    <!-- Overdue Tasks -->
    <div v-if="activeTab === 'overdue'">
      <div v-for="t in overdueTasks" :key="t.id" class="card m-task-card" @click="goTask(t.id)">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px">
          <span class="tag" :style="{ background: getPriority(t).bg, color: getPriority(t).color }">{{ getPriority(t).label }}</span>
          <span class="tag" style="background: #fff2f0; color: #ff4d4f">已逾期</span>
        </div>
        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 6px; line-height: 1.4">{{ t.title }}</h3>
        <div class="progress-bar" style="margin-bottom: 10px">
          <div class="progress-bar-fill" :style="{ width: t.progress + '%', background: '#ff4d4f' }"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 12px; color: var(--text-secondary)">{{ t.department }}</span>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 11px; color: var(--danger)">{{ t.urgCount }}次催办</span>
            <button class="btn btn-danger btn-sm" @click.stop="openUrgeForTask(t)">催办</button>
          </div>
        </div>
      </div>

      <div v-if="!overdueTasks.length" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p>没有逾期任务</p>
      </div>
    </div>

    <!-- Urge Panel -->
    <div v-if="showUrge" class="slide-panel">
      <div class="slide-overlay" @click="showUrge = false"></div>
      <div class="slide-content" style="padding: 24px">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px">发送催办通知</h3>
        <div v-if="urgeTarget" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px">
          目标任务: <strong>{{ urgeTarget.title }}</strong>
        </div>
        <div class="form-group">
          <label class="form-label">催办类型</label>
          <div style="display: flex; gap: 8px">
            <span class="filter-tab" :class="{ active: urgeType === 'urge' }" @click="urgeType = 'urge'">催办</span>
            <span class="filter-tab" :class="{ active: urgeType === 'warn' }" @click="urgeType = 'warn'">警告</span>
            <span class="filter-tab" :class="{ active: urgeType === 'escalate' }" @click="urgeType = 'escalate'">升级</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">催办内容</label>
          <textarea class="form-textarea" v-model="urgeMsg" placeholder="请输入催办内容"></textarea>
        </div>
        <button class="btn btn-primary" @click="handleUrge">发送通知</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { store, priorityMap, sendUrge } from '../../store/tasks.js'

const router = useRouter()
const goTask = id => router.push(`/m/task/${id}`)

const activeTab = ref('all')
const showUrge = ref(false)
const urgeMsg = ref('')
const urgeType = ref('urge')
const urgeTarget = ref(null)

function getPriority(task) { return priorityMap[task.priority] || {} }

const filters = [
  { key: 'all', label: '全部' },
  { key: 'urge', label: '催办' },
  { key: 'warn', label: '警告' },
  { key: 'escalate', label: '升级' },
  { key: 'overdue', label: '逾期任务' }
]

const overdueTasks = computed(() => store.tasks.filter(t => t.status === 'overdue'))
const highUrgTasks = computed(() => store.tasks.filter(t => t.urgCount >= 3))
const escalatedCount = computed(() => store.supervisionLogs.filter(l => l.type === 'escalate').length)

const filteredLogs = computed(() => {
  if (activeTab.value === 'all') return store.supervisionLogs
  if (activeTab.value === 'overdue') return []
  return store.supervisionLogs.filter(l => l.type === activeTab.value)
})

function logTypeLabel(type) {
  return { urge: '催办', warn: '警告', escalate: '升级' }[type] || type
}

function logTypeStyle(type) {
  const map = {
    urge: { background: '#fff2f0', color: '#ff4d4f' },
    warn: { background: '#fff7e6', color: '#fa8c16' },
    escalate: { background: '#f9f0ff', color: '#722ed1' }
  }
  return map[type] || {}
}

function openUrgeForTask(task) {
  urgeTarget.value = task
  urgeMsg.value = ''
  urgeType.value = 'urge'
  showUrge.value = true
}

function handleUrge() {
  if (!urgeMsg.value.trim() || !urgeTarget.value) return
  sendUrge(urgeTarget.value.id, urgeMsg.value, urgeType.value)
  showUrge.value = false
  urgeMsg.value = ''
  urgeType.value = 'urge'
  urgeTarget.value = null
}
</script>

<style scoped>
.m-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px 16px;
}
.m-stat-card {
  margin: 0;
  text-align: center;
  padding: 10px 8px !important;
}
.m-stat-num {
  font-size: 20px;
  font-weight: 700;
}
.m-stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.m-task-card {
  cursor: pointer;
}
</style>
