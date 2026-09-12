<template>
  <div class="module-select-page">
    <div class="select-header">
      <div class="header-left">
        <img :src="logoImg" alt="Logo" class="header-logo" />
        <span class="header-title">协同管理平台</span>
      </div>
      <div class="header-right">
        <div class="user-avatar">{{ authStore.user?.name?.charAt(0) || "?" }}</div>
        <span class="user-name">{{ authStore.user?.name }}</span>
        <span class="user-dept">{{ authStore.user?.department }}</span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </div>
    <div class="select-body">
      <h1 class="select-title">选择业务模块</h1>
      <p class="select-subtitle">请选择您需要进入的管理模块</p>
      <div class="module-grid">
        <div v-for="mod in modules" :key="mod.moduleKey" class="module-card" :class="{ disabled: !isModuleAccessible(mod) }" @click="enterModule(mod)">
          <div class="card-icon" :style="{ background: getModuleColor(mod.moduleKey) }">
            <span v-html="getModuleIcon(mod.moduleKey)"></span>
          </div>
          <div class="card-info">
            <h3 class="card-name">{{ mod.name }}</h3>
            <p class="card-desc">{{ mod.description }}</p>
          </div>
          <div v-if="!isModuleAccessible(mod)" class="card-lock">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>
      </div>

        <div v-if="authStore.user?.role === 'admin'" class="module-card" style="border:2px dashed #d9d9d9" @click="goAccount">
          <div class="card-icon" style="background:linear-gradient(135deg, #722ed1, #9254de)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="card-info">
            <h3 class="card-name">账号管理</h3>
            <p class="card-desc">管理账号与模块权限</p>
          </div>
        </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { authStore, logout } from "../store/auth.js"
import { moduleAPI } from "../api/index.js"
import logoImg from "../assets/logo.jpg"
const router = useRouter()
const modules = ref([])
onMounted(async () => {
  try {
    const data = await moduleAPI.myModules()
    modules.value = data.modules
  } catch (e) { console.error("Failed to load modules", e) }
})
function isModuleAccessible(mod) {
  if (authStore.user?.role === "admin") return true
  const userModules = authStore.user?.modules || []
  return userModules.some(m => m.moduleKey === mod.moduleKey)
}
function enterModule(mod) {
  if (!isModuleAccessible(mod)) return
  router.push(mod.path)
}
function goAccount() { router.push('/admin/users') }
function handleLogout() { logout(); router.push("/admin/login") }
function getModuleColor(key) {
  const c = { project:"#1677ff", tech_quality:"#52c41a", procurement:"#fa8c16", admin_general:"#722ed1", hr:"#13c2c2", finance:"#faad14", manufacturing:"#ff4d4f", safety:"#fa541c" }
  return "linear-gradient(135deg, " + (c[key]||"#1677ff") + ", " + (c[key]||"#1677ff") + "88)"
}
function getModuleIcon(key) {
  const i = {
    project: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    tech_quality: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.01V21a4 4 0 0 1-8 0v-.09a1.65 1.65 0 0 0-1.01-2.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    procurement: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    admin_general: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    hr: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    finance: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    manufacturing: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.01V21a4 4 0 0 1-8 0v-.09a1.65 1.65 0 0 0-1.01-2.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    safety: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  }
  return i[key] || i.project
}
</script>
<style scoped>
.module-select-page{min-height:100vh;background:#f0f2f5}
.select-header{height:64px;background:#001529;display:flex;align-items:center;justify-content:space-between;padding:0 32px}
.header-left{display:flex;align-items:center;gap:12px}
.header-logo{height:32px;object-fit:contain}
.header-title{font-size:18px;font-weight:600;color:#fff}
.header-right{display:flex;align-items:center;gap:12px}
.user-avatar{width:32px;height:32px;border-radius:50%;background:#1677ff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500}
.user-name{color:rgba(255,255,255,0.85);font-size:14px}
.user-dept{color:rgba(255,255,255,0.45);font-size:12px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:4px}
.btn-logout{background:transparent;border:1px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.65);padding:4px 16px;border-radius:4px;cursor:pointer;font-size:13px;transition:all 0.2s}
.btn-logout:hover{border-color:#ff4d4f;color:#ff4d4f}
.select-body{max-width:960px;margin:0 auto;padding:60px 24px}
.select-title{font-size:28px;font-weight:700;color:#1d2129;text-align:center;margin:0 0 8px}
.select-subtitle{font-size:15px;color:#86909c;text-align:center;margin:0 0 48px}
.module-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.module-card{background:#fff;border-radius:12px;padding:28px 20px;cursor:pointer;transition:all 0.25s;position:relative;border:1px solid #f0f0f0;display:flex;flex-direction:column;align-items:center;text-align:center}
.module-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,0.08);border-color:#e8e8e8}
.module-card.disabled{opacity:0.5;cursor:not-allowed}
.module-card.disabled:hover{transform:none;box-shadow:none}
.card-icon{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.card-name{font-size:16px;font-weight:600;color:#1d2129;margin:0 0 6px}
.card-desc{font-size:13px;color:#86909c;margin:0;line-height:1.4}
.card-lock{position:absolute;top:12px;right:12px;color:#c9cdd4}
@media(max-width:768px){.module-grid{grid-template-columns:repeat(2,1fr);gap:12px}.select-body{padding:32px 16px}.select-title{font-size:22px}}
</style>
