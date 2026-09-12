<template>
  <div class="card" @click="$emit('click', task)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <span class="tag" :style="{ background: priority.bg, color: priority.color }">{{ priority.label }}</span>
      <span class="tag" :style="{ background: status.bg, color: status.color }">{{ status.label }}</span>
    </div>
    <h3 style="font-size:15px;font-weight:600;margin-bottom:6px;line-height:1.4">{{ task.title }}</h3>
    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{{ task.description }}</p>
    <div class="progress-bar" style="margin-bottom:10px">
      <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: progressColor }"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="avatar" :style="{ background: avatarColor(task.publisher.name) }">{{ task.publisher.name[0] }}</div>
        <span style="font-size:12px;color:var(--text-secondary)">{{ task.publisher.name }}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span v-if="task.urgCount > 0" style="font-size:11px;color:var(--danger)">\u26A0 {{ task.urgCount }}\u6B21\u50AC\u529E</span>
        <span style="font-size:11px;color:var(--text-caption)">{{ task.deadline }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { priorityMap, statusMap } from '../mock/data.js'

const props = defineProps({ task: { type: Object, required: true } })
defineEmits(['click'])

const priority = computed(() => priorityMap[props.task.priority])
const status = computed(() => statusMap[props.task.status])
const progressColor = computed(() => {
  if (props.task.progress >= 80) return '#52c41a'
  if (props.task.progress >= 50) return '#1677ff'
  if (props.task.progress >= 20) return '#fa8c16'
  return '#ff4d4f'
})

function avatarColor(name) {
  const colors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
</script>
