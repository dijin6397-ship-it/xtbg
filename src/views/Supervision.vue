<template>
  <div class="page">
    <div class="page-header">
      <h1>\u{1F6A8} \u7763\u529E\u4E2D\u5FC3</h1>
      <p>\u4EFB\u52A1\u7763\u529E\u4E0E\u50AC\u529E\u7BA1\u7406</p>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px">
      <div class="card" style="margin:0;text-align:center;padding:10px 8px">
        <div style="font-size:20px;font-weight:700;color:var(--danger)">{{ overdueTasks.length }}</div>
        <div style="font-size:11px;color:var(--text-secondary)">\u5DF2\u903E\u671F</div>
      </div>
      <div class="card" style="margin:0;text-align:center;padding:10px 8px">
        <div style="font-size:20px;font-weight:700;color:var(--warning)">{{ highUrgTasks.length }}</div>
        <div style="font-size:11px;color:var(--text-secondary)">\u50AC\u529E\u003E\u0033\u6B21</div>
      </div>
      <div class="card" style="margin:0;text-align:center;padding:10px 8px">
        <div style="font-size:20px;font-weight:700;color:#722ed1">{{ escalatedCount }}</div>
        <div style="font-size:11px;color:var(--text-secondary)">\u5DF2\u5347\u7EA7</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-tabs">
      <span v-for="f in filters" :key="f.key" class="filter-tab" :class="{ active: activeTab === f.key }" @click="activeTab = f.key">{{ f.label }}</span>
    </div>

    <!-- Supervision Log List -->
    <div v-for="log in filteredLogs" :key="log.id" class="card supervision-card" :class="log.type" style="cursor:pointer" @click="goTask(log.taskId)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="tag" :style="logTypeStyle(log.type)">{{ logTypeLabel(log.type) }}</span>
        <span style="font-size:11px;color:var(--text-caption)">{{ log.time }}</span>
      </div>
      <p style="font-size:13px;margin-bottom:8px;line-height:1.5">{{ log.content }}</p>
      <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--text-secondary)">
        <span>\u64CD\u4F5C\u4EBA: {{ log.operator.name }}</span>
        <span>\u2192</span>
        <span>\u8D23\u4EFB\u4EBA: {{ log.target.name }}</span>
      </div>
    </div>

    <!-- Overdue Tasks -->
    <div v-if="activeTab === 'overdue'" style="padding:0 16px;margin-top:8px">
      <h2 style="font-size:15px;font-weight:600;margin-bottom:8px">\u{1F534} \u903E\u671F\u4EFB\u52A1\u5217\u8868</h2>
    </div>
    <TaskCard v-for="t in overdueTasks" :key="t.id" :task="t" @click="goTask(t.id)" />

    <!-- Urge Action -->
    <div v-if="showUrge" class="slide-panel">
      <div class="slide-overlay" @click="showUrge = false"></div>
      <div class="slide-content" style="padding:24px">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">\u53D1\u9001\u50AC\u529E\u901A\u77E5</h3>
        <div class="form-group">
          <label class="form-label">\u50AC\u529E\u5185\u5BB9</label>
          <textarea class="form-textarea" v-model="urgeMsg" placeholder="\u8BF7\u8F93\u5165\u50AC\u529E\u5185\u5BB9"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">\u7D27\u6025\u7A0B\u5EA6</label>
          <div style="display:flex;gap:8px">
            <span class="filter-tab" :class="{ active: urgeType === 'urge' }" @click="urgeType = 'urge'">\u50AC\u529E</span>
            <span class="filter-tab" :class="{ active: urgeType === 'warn' }" @click="urgeType = 'warn'">\u8B66\u544A</span>
            <span class="filter-tab" :class="{ active: urgeType === 'escalate' }" @click="urgeType = 'escalate'">\u5347\u7EA7</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="sendUrge">\u53D1\u9001\u901A\u77E5</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { tasks, supervisionLogs } from '../mock/data.js'
import TaskCard from '../components/TaskCard.vue'

const router = useRouter()
const goTask = id => router.push(`/task/${id}`)

const activeTab = ref('all')
const showUrge = ref(false)
const urgeMsg = ref('')
const urgeType = ref('urge')

const filters = [
  { key: 'all', label: '\u5168\u90E8' },
  { key: 'urge', label: '\u50AC\u529E' },
  { key: 'warn', label: '\u8B66\u544A' },
  { key: 'escalate', label: '\u5347\u7EA7' },
  { key: 'overdue', label: '\u903E\u671F\u4EFB\u52A1' }
]

const overdueTasks = computed(() => tasks.filter(t => t.status === 'overdue'))
const highUrgTasks = computed(() => tasks.filter(t => t.urgCount >= 3))
const escalatedCount = computed(() => supervisionLogs.filter(l => l.type === 'escalate').length)

const filteredLogs = computed(() => {
  if (activeTab.value === 'all') return supervisionLogs
  if (activeTab.value === 'overdue') return []
  return supervisionLogs.filter(l => l.type === activeTab.value)
})

function logTypeLabel(type) {
  return { urge: '\u50AC\u529E', warn: '\u8B66\u544A', escalate: '\u5347\u7EA7' }[type] || type
}

function logTypeStyle(type) {
  const map = { urge: { background: '#fff2f0', color: '#ff4d4f' }, warn: { background: '#fff7e6', color: '#fa8c16' }, escalate: { background: '#f9f0ff', color: '#722ed1' } }
  return map[type] || {}
}

function sendUrge() {
  showUrge.value = false
  urgeMsg.value = ''
}
</script>
