<template>
  <div class="coming-soon-page">
    <div class="cs-header">
      <div class="cs-header-left">
        <img :src="logoImg" alt="Logo" class="cs-logo" />
        <span class="cs-title">协同管理平台</span>
      </div>
      <button class="btn-back" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        返回模块选择
      </button>
    </div>
    <div class="cs-body">
      <div class="cs-icon" :style="{ background: getModuleColor(moduleKey) }">
        <span v-html="getModuleIcon(moduleKey)"></span>
      </div>
      <h1 class="cs-name">{{ moduleName }}</h1>
      <p class="cs-status">功能开发中</p>
      <p class="cs-desc">该模块正在建设中，敬请期待</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoImg from '../assets/logo.jpg'

const route = useRoute()
const router = useRouter()
const moduleKey = computed(() => route.params.key || '')
const moduleName = computed(() => {
  const names = {
    project: '项目管理', procurement: '采购管理', 'admin-general': '行政综合管理',
    hr: '人事管理', finance: '财务管理', manufacturing: '生产制造管理', safety: '安全管理'
  }
  return names[moduleKey.value] || moduleKey.value
})

function goBack() { router.push('/select-module') }

function getModuleColor(key) {
  const c = { project:'#1677ff', procurement:'#fa8c16', 'admin-general':'#722ed1', hr:'#13c2c2', finance:'#faad14', manufacturing:'#ff4d4f', safety:'#fa541c' }
  return 'linear-gradient(135deg, ' + (c[key]||'#1677ff') + ', ' + (c[key]||'#1677ff') + '88)'
}
function getModuleIcon(key) {
  const icons = {
    project: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    procurement: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    'admin-general': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    hr: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    finance: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    manufacturing: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.01V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    safety: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  }
  return icons[key] || icons.project
}
</script>

<style scoped>
.coming-soon-page { min-height: 100vh; background: #f0f2f5; }
.cs-header {
  height: 64px; background: #001529; display: flex; align-items: center;
  justify-content: space-between; padding: 0 32px;
}
.cs-header-left { display: flex; align-items: center; gap: 12px; }
.cs-logo { height: 32px; object-fit: contain; }
.cs-title { font-size: 18px; font-weight: 600; color: #fff; }
.btn-back {
  display: flex; align-items: center; gap: 6px; background: transparent;
  border: 1px solid rgba(255,255,255,0.3); color: rgba(255,255,255,0.65);
  padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;
  transition: all 0.2s;
}
.btn-back:hover { border-color: #1677ff; color: #1677ff; }
.cs-body {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 120px 24px;
}
.cs-icon {
  width: 96px; height: 96px; border-radius: 24px; display: flex;
  align-items: center; justify-content: center; margin-bottom: 24px;
}
.cs-name { font-size: 24px; font-weight: 700; color: #1d2129; margin: 0 0 12px; }
.cs-status {
  font-size: 16px; color: #faad14; background: #fffbe6;
  padding: 4px 16px; border-radius: 4px; margin: 0 0 12px; font-weight: 500;
}
.cs-desc { font-size: 14px; color: #86909c; margin: 0; }
</style>
