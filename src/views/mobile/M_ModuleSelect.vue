<template>
  <div class="m-module-select">
    <div class="mms-header">
      <h1 class="mms-title">选择模块</h1>
      <p class="mms-subtitle">{{ authStore.user?.name }}，请选择要进入的模块</p>
    </div>
    <div class="mms-grid">
      <div v-for="mod in modules" :key="mod.moduleKey" class="mms-card" @click="enterModule(mod)">
        <div class="mms-card-icon" :style="{ background: getModuleColor(mod.moduleKey) }">
          <span v-html="getModuleIcon(mod.moduleKey)"></span>
        </div>
        <div class="mms-card-info">
          <h3>{{ mod.name }}</h3>
          <p>{{ mod.description }}</p>
        </div>
      </div>
      <div v-if="authStore.user?.role === 'admin'" class="mms-card mms-card-admin" @click="goAccount">
        <div class="mms-card-icon" style="background: linear-gradient(135deg, #722ed1, #9254de)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="mms-card-info">
          <h3>账号管理</h3>
          <p>管理账号与模块权限</p>
        </div>
      </div>
    </div>
    <div class="mms-footer">
      <button class="mms-logout" @click="handleLogout">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore, logout } from '../../store/auth.js'
import { moduleAPI } from '../../api/index.js'

const router = useRouter()
const modules = ref([])

onMounted(async () => {
  try {
    const data = await moduleAPI.myModules()
    modules.value = data.modules
  } catch (e) { console.error('Failed to load modules', e) }
})

function enterModule(mod) {
  if (mod.moduleKey === 'tech_quality') {
    router.push('/m/dashboard')
  } else {
    router.push(mod.path)
  }
}
function goAccount() { router.push('/m/account') }
function handleLogout() { logout(); router.push('/admin/login?from=mobile') }

function getModuleColor(key) {
  const c = { project:'#1677ff', tech_quality:'#52c41a', procurement:'#fa8c16', admin_general:'#722ed1', hr:'#13c2c2', finance:'#faad14', manufacturing:'#ff4d4f', safety:'#fa541c' }
  return 'linear-gradient(135deg, ' + (c[key]||'#1677ff') + ', ' + (c[key]||'#1677ff') + '88)'
}
function getModuleIcon(key) {
  const i = {
    project: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    tech_quality: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.01V21a4 4 0 0 1-8 0v-.09a1.65 1.65 0 0 0-1.01-2.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    procurement: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    admin_general: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    hr: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    finance: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    manufacturing: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.01V21a4 4 0 0 1-8 0v-.09a1.65 1.65 0 0 0-1.01-2.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    safety: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  }
  return i[key] || i.project
}
</script>

<style scoped>
.m-module-select { min-height: 100vh; background: #f0f2f5; padding-bottom: 40px; }
.mms-header { background: linear-gradient(135deg, #1677ff, #4096ff); padding: 32px 20px 24px; color: #fff; }
.mms-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
.mms-subtitle { font-size: 14px; opacity: 0.85; margin: 0; }
.mms-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; margin-top: -12px; }
.mms-card { background: #fff; border-radius: 12px; padding: 20px 16px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.2s; }
.mms-card:active { transform: scale(0.97); }
.mms-card-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.mms-card-info h3 { font-size: 14px; font-weight: 600; color: #1d2129; margin: 0 0 4px; }
.mms-card-info p { font-size: 12px; color: #86909c; margin: 0; line-height: 1.4; }
.mms-card-admin { border: 1px dashed #d9d9d9; }
.mms-footer { padding: 24px 16px 0; text-align: center; }
.mms-logout { background: none; border: 1px solid #d9d9d9; color: #86909c; padding: 10px 32px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.mms-logout:active { color: #ff4d4f; border-color: #ff4d4f; }
</style>
