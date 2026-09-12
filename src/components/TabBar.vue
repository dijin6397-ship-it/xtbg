<template>
  <nav class="tab-bar">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab-bar-item"
      :class="{ active: $route.path === tab.path }"
    >
      <span class="icon">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
      <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { tasks } from '../mock/data.js'

const overdueCount = computed(() => tasks.filter(t => t.status === 'overdue' || t.urgCount >= 3).length)

const tabs = computed(() => [
  { path: '/dashboard', icon: '\u{1F3E0}', label: '工作台' },
  { path: '/tasks', icon: '\u{1F4CB}', label: '任务' },
  { path: '/publish', icon: '\u{2795}', label: '发布' },
  { path: '/supervision', icon: '\u{1F6A8}', label: '督办', badge: overdueCount.value || null }
])
</script>
