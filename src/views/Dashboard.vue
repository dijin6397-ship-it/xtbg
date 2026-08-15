<template>
  <div class="page">
    <div class="page-header">
      <h1>\u{1F44B} \u6B22\u8FCE\u56DE\u6765</h1>
      <p>\u4ECA\u65E5\u662F {{ today }} \u00B7 \u6709 {{ urgentCount }} \u9879\u7D27\u6025\u4EFB\u52A1\u5F85\u5904\u7406</p>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 16px">
      <div v-for="s in stats" :key="s.label" class="card" style="margin:0;text-align:center;padding:12px 8px">
        <div :style="{ fontSize:'22px',fontWeight:'700',color:s.color }">{{ s.count }}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">{{ s.label }}</div>
      </div>
    </div>

    <!-- Urgent -->
    <div v-if="urgentTasks.length" style="padding:0 16px">
      <h2 style="font-size:15px;font-weight:600;margin-bottom:8px">\u{1F534} \u7D27\u6025\u4EFB\u52A1</h2>
    </div>
    <TaskCard v-for="t in urgentTasks" :key="t.id" :task="t" @click="goDetail(t.id)" />

    <!-- Recent -->
    <div style="padding:0 16px;margin-top:8px">
      <h2 style="font-size:15px;font-weight:600;margin-bottom:8px">\u{1F4DD} \u6700\u8FD1\u4EFB\u52A1</h2>
    </div>
    <TaskCard v-for="t in recentTasks" :key="t.id" :task="t" @click="goDetail(t.id)" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { tasks } from '../mock/data.js'
import TaskCard from '../components/TaskCard.vue'

const router = useRouter()
const goDetail = id => router.push(`/task/${id}`)

const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

const stats = computed(() => [
  { label: '\u5F85\u5904\u7406', count: tasks.filter(t => t.status === 'pending').length, color: '#8c8c8c' },
  { label: '\u8FDB\u884C\u4E2D', count: tasks.filter(t => t.status === 'in_progress').length, color: '#1677ff' },
  { label: '\u5DF2\u903E\u671F', count: tasks.filter(t => t.status === 'overdue').length, color: '#ff4d4f' },
  { label: '\u5DF2\u5B8C\u6210', count: tasks.filter(t => t.status === 'completed').length, color: '#52c41a' }
])

const urgentCount = computed(() => tasks.filter(t => t.status === 'overdue' || t.priority === 'urgent').length)
const urgentTasks = computed(() => tasks.filter(t => t.priority === 'urgent' || t.status === 'overdue').slice(0, 3))
const recentTasks = computed(() => [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4))
</script>
