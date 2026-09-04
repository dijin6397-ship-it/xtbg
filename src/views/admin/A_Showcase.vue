<template>
  <div class="showcase-page">
    <h2 class="page-title">任务完成情况展示</h2>

    <div class="overview-card card">
      <div class="overview-stats">
        <div class="overview-item"><div class="ov-value">{{ tasks.length }}</div><div class="ov-label">总任务数</div></div>
        <div class="overview-item"><div class="ov-value" style="color:var(--success)">{{ completedCount }}</div><div class="ov-label">已完成</div></div>
        <div class="overview-item"><div class="ov-value" style="color:var(--primary)">{{ activeCount }}</div><div class="ov-label">进行中</div></div>
        <div class="overview-item"><div class="ov-value" style="color:var(--danger)">{{ overdueCount }}</div><div class="ov-label">已逾期</div></div>
      </div>
      <div class="ring-wrap">
        <div class="ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" stroke-width="10"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--success)" stroke-width="10" stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 50" :stroke-dashoffset="2 * Math.PI * 50 * (1 - completionRate / 100)"
              transform="rotate(-90 60 60)" class="ring-progress"/>
          </svg>
          <div class="ring-center"><span class="ring-value">{{ completionRate }}%</span><span class="ring-label">完成率</span></div>
        </div>
      </div>
    </div>

    <div class="card section-card" v-for="group in taskGroups" :key="group.key">
      <h3 class="section-title"><span class="group-dot" :style="{ background: group.color }"></span>{{ group.label }} ({{ group.tasks.length }})</h3>
      <div class="task-wall" v-if="group.tasks.length">
        <div v-for="task in group.tasks" :key="task.id" class="task-card" :style="{ borderColor: group.color }" @click="$router.push(`/admin/task/${task.id}`)">
          <div class="tc-header">
            <span class="tc-title">{{ task.title }}</span>
            <span class="tag" :style="{ color: taskTypeMap[task.task_type]?.color, background: taskTypeMap[task.task_type]?.bg }">{{ taskTypeMap[task.task_type]?.label }}</span>
          </div>
          <div class="tc-progress">
            <div class="progress-bar" style="width:100%;height:6px"><div class="progress-bar-fill" :style="{ width: task.progress + '%', background: group.color }"></div></div>
            <span class="progress-text">{{ task.progress }}%</span>
          </div>
          <div class="tc-meta"><span>{{ task.supervisor?.name }}</span><span>{{ task.deadline }}</span></div>
        </div>
      </div>
      <div v-else class="empty-wall">该分组暂无任务</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { taskAPI } from '../../api/index.js'
import { taskTypeMap } from '../../store/auth.js'

const tasks = ref([])
const completedCount = computed(() => tasks.value.filter(t => t.status === 'completed').length)
const activeCount = computed(() => tasks.value.filter(t => ['in_progress', 'decomposing', 'feedback'].includes(t.status)).length)
const overdueCount = computed(() => tasks.value.filter(t => t.status === 'overdue').length)
const completionRate = computed(() => tasks.value.length ? Math.round(completedCount.value / tasks.value.length * 100) : 0)

const taskGroups = computed(() => [
  { key: 'completed', label: '已完成', color: 'var(--success)', tasks: tasks.value.filter(t => t.status === 'completed') },
  { key: 'active', label: '进行中', color: 'var(--primary)', tasks: tasks.value.filter(t => ['in_progress', 'decomposing', 'feedback'].includes(t.status)) },
  { key: 'pending', label: '待处理', color: '#d9d9d9', tasks: tasks.value.filter(t => ['pending', 'review', 'overdue'].includes(t.status)) }
])

onMounted(async () => {
  try { const data = await taskAPI.list(); tasks.value = data.tasks } catch (e) { console.error(e) }
})
</script>

<style scoped>
.showcase-page { display: flex; flex-direction: column; gap: 24px; }
.page-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0; }
.card { background: #fff; border-radius: var(--radius); padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.overview-card { display: flex; align-items: center; justify-content: space-between; gap: 32px; }
.overview-stats { display: flex; gap: 40px; }
.overview-item { text-align: center; }
.ov-value { font-size: 32px; font-weight: 700; color: var(--text); }
.ov-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.ring { position: relative; width: 120px; height: 120px; }
.ring svg { width: 100%; height: 100%; }
.ring-progress { transition: stroke-dashoffset 0.8s ease; }
.ring-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
.ring-value { display: block; font-size: 22px; font-weight: 700; color: var(--text); }
.ring-label { display: block; font-size: 11px; color: var(--text-secondary); }
.section-card { padding: 20px 24px; }
.section-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
.group-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.task-wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.task-card { border: 1px solid #e5e6eb; border-left: 4px solid; border-radius: 8px; padding: 16px; cursor: pointer; transition: box-shadow 0.2s; }
.task-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.tc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
.tc-title { font-size: 14px; font-weight: 600; color: var(--text); flex: 1; line-height: 1.4; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tc-progress { margin-bottom: 8px; }
.progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: var(--text-secondary); margin-top: 4px; display: inline-block; }
.tc-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-caption); }
.empty-wall { text-align: center; color: var(--text-caption); font-size: 13px; padding: 20px; }
@media (max-width: 768px) { .overview-card { flex-direction: column; align-items: flex-start; } .overview-stats { flex-wrap: wrap; gap: 20px; } }
</style>
