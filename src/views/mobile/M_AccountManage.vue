<template>
  <div class="m-account">
    <div class="ma-header">
      <button class="ma-back" @click="$router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1 class="ma-title">账号管理</h1>
    </div>
    <div class="ma-search">
      <input v-model="search" class="ma-search-input" placeholder="搜索姓名或用户名..." />
    </div>
    <div class="ma-user-list">
      <div v-for="user in filteredUsers" :key="user.id" class="ma-user-card" @click="editUser(user)">
        <div class="ma-user-avatar" :style="{ background: avatarColor(user.name) }">{{ user.name[0] }}</div>
        <div class="ma-user-info">
          <div class="ma-user-name">{{ user.name }} <span class="ma-user-role">{{ roleMap[user.role] || user.role }}</span></div>
          <div class="ma-user-dept">{{ user.department }}</div>
          <div class="ma-user-modules">
            <span v-for="m in getAssignedModules(user)" :key="m.id" class="ma-module-tag">{{ m.name }}</span>
            <span v-if="getAssignedModules(user).length === 0" class="ma-module-empty">无模块权限</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
    <div v-if="editingUser" class="ma-modal-mask" @click.self="editingUser = null">
      <div class="ma-modal">
        <div class="ma-modal-header">
          <h2>{{ editingUser.name }} - 模块权限</h2>
          <button class="ma-modal-close" @click="editingUser = null">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="ma-modal-body">
          <div v-for="mod in allModules" :key="mod.id" class="ma-mod-toggle">
            <div class="ma-mod-info">
              <span class="ma-mod-name">{{ mod.name }}</span>
              <span class="ma-mod-desc">{{ mod.moduleKey }}</span>
            </div>
            <label class="ma-switch">
              <input type="checkbox" :checked="isAssigned(mod)" @change="toggleModule(mod)" />
              <span class="ma-slider"></span>
            </label>
          </div>
        </div>
        <div class="ma-modal-footer">
          <button class="ma-btn-save" @click="saveModules" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { roleMap } from '../../store/auth.js'

const BASE = '/api'
function getToken() { return localStorage.getItem('token') }
async function api(url, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers }
  const res = await fetch(BASE + url, { ...opts, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'request failed')
  return data
}

const search = ref('')
const users = ref([])
const allModules = ref([])
const editingUser = ref(null)
const editedModules = ref([])
const saving = ref(false)

onMounted(async () => {
  try {
    const data = await api('/users/full')
    users.value = data.users
    allModules.value = data.modules
  } catch (e) { console.error('Failed to load users', e) }
})

const filteredUsers = computed(() => {
  if (!search.value) return users.value
  const q = search.value.toLowerCase()
  return users.value.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
})

function getAssignedModules(user) {
  if (!user.modules) return []
  return user.modules.filter(m => m.assigned)
}
function avatarColor(name) {
  const colors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
function editUser(user) {
  editingUser.value = user
  editedModules.value = allModules.value.map(m => ({
    id: m.id,
    assigned: user.modules ? user.modules.some(um => um.id === m.id && um.assigned) : false
  }))
}
function isAssigned(mod) {
  const em = editedModules.value.find(e => e.id === mod.id)
  return em ? em.assigned : false
}
function toggleModule(mod) {
  const em = editedModules.value.find(e => e.id === mod.id)
  if (em) em.assigned = !em.assigned
}
async function saveModules() {
  saving.value = true
  try {
    const moduleIds = editedModules.value.filter(e => e.assigned).map(e => e.id)
    await api('/modules/' + editingUser.value.id, { method: 'PUT', body: JSON.stringify({ moduleIds }) })
    const user = users.value.find(u => u.id === editingUser.value.id)
    if (user) {
      user.modules = allModules.value.map(m => ({
        id: m.id, moduleKey: m.moduleKey, name: m.name, assigned: moduleIds.includes(m.id)
      }))
    }
    editingUser.value = null
  } catch (e) { alert('保存失败: ' + e.message) }
  finally { saving.value = false }
}
</script>

<style scoped>
.m-account { min-height: 100vh; background: #f0f2f5; }
.ma-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #f0f0f0; }
.ma-back { background: none; border: none; padding: 4px; cursor: pointer; display: flex; }
.ma-title { font-size: 17px; font-weight: 600; margin: 0; }
.ma-search { padding: 12px 16px 0; }
.ma-search-input { width: 100%; height: 40px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; background: #fff; }
.ma-search-input:focus { border-color: #1677ff; }
.ma-user-list { padding: 8px 16px; }
.ma-user-card { display: flex; align-items: flex-start; gap: 12px; background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 8px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.ma-user-card:active { background: #fafafa; }
.ma-user-avatar { width: 40px; height: 40px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; flex-shrink: 0; }
.ma-user-info { flex: 1; min-width: 0; }
.ma-user-name { font-size: 15px; font-weight: 600; color: #1d2129; }
.ma-user-role { font-size: 11px; color: #1677ff; background: #e6f4ff; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
.ma-user-dept { font-size: 12px; color: #86909c; margin: 2px 0 6px; }
.ma-user-modules { display: flex; flex-wrap: wrap; gap: 4px; }
.ma-module-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
.ma-module-empty { font-size: 11px; color: #c9cdd4; }
.ma-modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
.ma-modal { background: #fff; width: 100%; max-width: 480px; border-radius: 16px 16px 0 0; max-height: 80vh; overflow-y: auto; }
.ma-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.ma-modal-header h2 { font-size: 16px; margin: 0; }
.ma-modal-close { background: none; border: none; padding: 4px; cursor: pointer; display: flex; }
.ma-modal-body { padding: 12px 20px; }
.ma-mod-toggle { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.ma-mod-info { display: flex; flex-direction: column; }
.ma-mod-name { font-size: 14px; font-weight: 500; color: #1d2129; }
.ma-mod-desc { font-size: 12px; color: #86909c; }
.ma-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.ma-switch input { opacity: 0; width: 0; height: 0; }
.ma-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #d9d9d9; border-radius: 12px; cursor: pointer; transition: background 0.2s; }
.ma-slider::before { content: ''; position: absolute; width: 20px; height: 20px; left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
.ma-switch input:checked + .ma-slider { background: #1677ff; }
.ma-switch input:checked + .ma-slider::before { transform: translateX(20px); }
.ma-modal-footer { padding: 12px 20px 20px; }
.ma-btn-save { width: 100%; height: 44px; background: #1677ff; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
.ma-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
