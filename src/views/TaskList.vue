<template>
  <div class="page">
    <div class="page-header">
      <h1>\u4EFB\u52A1\u5217\u8868</h1>
      <p>\u5171 {{ filteredTasks.length }} \u9879\u4EFB\u52A1</p>
    </div>

    <div class="filter-tabs">
      <span v-for="f in filters" :key="f.key" class="filter-tab" :class="{ active: activeFilter === f.key }" @click="activeFilter = f.key">
        {{ f.label }}
      </span>
    </div>

    <div class="filter-tabs" style="padding-top:0">
      <span v-for="p in priorities" :key="p.key" class="filter-tab" :class="{ active: activePriority === p.key }" @click="activePriority = p.key">
        {{ p.label }}
      </span>
    </div>

    <TaskCard v-for="t in filteredTasks" :key="t.id" :task="t" @click="goDetail(t.id)" />

    <div v-if="!filteredTasks.length" class="empty-state">
      <div class="icon">\u{1F4ED}</div>
      <p>\u6682\u65E0\u4EFB\u52A1</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { tasks } from '../mock/data.js'
import TaskCard from '../components/TaskCard.vue'

const router = useRouter()
const goDetail = id => router.push(`/task/${id}`)

const activeFilter = ref('all')
const activePriority = ref('all')

const filters = [
  { key: 'all', label: '\u5168\u90E8' },
  { key: 'pending', label: '\u5F85\u5F00\u59CB' },
  { key: 'in_progress', label: '\u8FDB\u884C\u4E2D' },
  { key: 'review', label: '\u5F85\u9A8C\u6536' },
  { key: 'overdue', label: '\u5DF2\u903E\u671F' },
  { key: 'completed', label: '\u5DF2\u5B8C\u6210' }
]

const priorities = [
  { key: 'all', label: '\u5168\u90E8\u4F18\u5148\u7EA7' },
  { key: 'urgent', label: '\u7D27\u6025' },
  { key: 'high', label: '\u91CD\u8981' },
  { key: 'normal', label: '\u666E\u901A' }
]

const filteredTasks = computed(() => {
  return tasks.filter(t => {
    if (activeFilter.value !== 'all' && t.status !== activeFilter.value) return false
    if (activePriority.value !== 'all' && t.priority !== activePriority.value) return false
    return true
  })
})
</script>
