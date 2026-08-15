<template>
  <div class="mobile-layout">
    <div class="mobile-header">
      <img :src="logoImg" alt="Logo" class="mobile-logo" />
    </div>
    <router-view />
    <nav class="tab-bar">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab-bar-item"
        :class="{ active: isActive(tab.path) }"
      >
        <span class="tab-icon" v-html="tab.svg"></span>
        <span>{{ tab.label }}</span>
        <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { store } from '../../store/tasks.js'
import logoImg from '../../assets/logo.jpg'

const route = useRoute()

const overdueCount = computed(() =>
  store.tasks.filter(t => t.status === 'overdue' || (t.urgCount >= 3 && t.status !== 'completed')).length
)

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

const tabs = computed(() => [
  {
    path: '/m/dashboard',
    label: '工作台',
    svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
  },
  {
    path: '/m/tasks',
    label: '任务',
    svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  },
  {
    path: '/m/publish',
    label: '发布',
    svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
  },
  {
    path: '/m/supervision',
    label: '督办',
    svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    badge: overdueCount.value || null
  }
])
</script>

<style scoped>
.mobile-layout {
  min-height: 100vh;
  background: var(--bg);
}
.mobile-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}
.mobile-logo {
  height: 32px;
  object-fit: contain;
}
</style>
