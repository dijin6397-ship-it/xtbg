<template>
  <div class="admin-layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#1677ff"/>
          <path d="M8 10h4v8H8zM14 7h4v11h-4zM20 13h4v5h-4z" fill="#fff"/>
        </svg>
        <span v-if="!sidebarCollapsed" class="logo-text">技术质量管理</span>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in visibleMenuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: currentPath.startsWith(item.path) }"
        >
          <span class="nav-icon" v-html="item.icon"></span>
          <span v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <router-link to="/select-module" class="nav-item footer-link">
          <span class="nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </span>
          <span v-if="!sidebarCollapsed" class="nav-label">模块选择</span>
        </router-link>
        <a class="nav-item footer-link" @click="handleLogout" style="cursor:pointer">
          <span class="nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          <span v-if="!sidebarCollapsed" class="nav-label">退出登录</span>
        </a>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line v-if="!sidebarCollapsed" x1="3" y1="12" x2="21" y2="12"/><line v-if="!sidebarCollapsed" x1="3" y1="6" x2="21" y2="6"/><line v-if="!sidebarCollapsed" x1="3" y1="18" x2="21" y2="18"/>
            <polyline v-if="sidebarCollapsed" points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <span class="topbar-title">{{ currentPageTitle }}</span>
        <div class="topbar-right">
          <img :src="logoImg" alt="Logo" class="topbar-logo" />
          <div class="notif-bell-wrap" @click="showNotifs = !showNotifs">
            <div class="notif-bell">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            </div>
            <div v-if="showNotifs" class="notif-dropdown">
              <div class="notif-header">
                <span>消息通知</span>
                <button class="notif-mark-read" @click.stop="markAllRead">全部已读</button>
              </div>
              <div v-if="!notifications.length" class="notif-empty">暂无通知</div>
              <div v-else class="notif-list">
                <div v-for="n in notifications" :key="n.id" class="notif-item" :class="{ unread: !n.isRead }" @click="handleNotifClick(n)">
                  <div class="notif-title">{{ n.title }}</div>
                  <div class="notif-content">{{ n.content }}</div>
                  <div class="notif-meta">
                    <span v-if="n.newDeadline">新截止日期: {{ n.newDeadline }}</span>
                    <span class="notif-time">{{ n.createdAt }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <span class="topbar-role">{{ roleLabel }}</span>
          <div class="user-info">
            <div class="avatar">{{ authStore.user?.name?.charAt(0) || '?' }}</div>
            <span class="user-name">{{ authStore.user?.name || '未登录' }}</span>
          </div>
        </div>
      </header>
      <main class="content-area">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authStore, logout, roleMap } from '../../store/auth.js'
import { notificationAPI } from '../../api/index.js'
import logoImg from '../../assets/logo.jpg'

const route = useRoute()
const router = useRouter()
const sidebarCollapsed = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const showNotifs = ref(false)

async function loadNotifications() {
  try {
    const data = await notificationAPI.list()
    notifications.value = data.notifications
    unreadCount.value = data.unreadCount
  } catch (e) { /* ignore */ }
}

async function markAllRead() {
  try {
    await notificationAPI.markRead([])
    notifications.value.forEach(n => n.isRead = true)
    unreadCount.value = 0
  } catch (e) { /* ignore */ }
}

function handleNotifClick(n) {
  if (!n.isRead) {
    notificationAPI.markRead([n.id]).catch(() => {})
    n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  if (n.taskId) {
    showNotifs.value = false
    router.push(`/admin/task/${n.taskId}`)
  }
}

let notifTimer = null
onMounted(() => {
  loadNotifications()
  notifTimer = setInterval(loadNotifications, 30000)
})
onUnmounted(() => { if (notifTimer) clearInterval(notifTimer) })

const currentPath = computed(() => route.path)
const roleLabel = computed(() => roleMap[authStore.user?.role] || '')

const currentPageTitle = computed(() => {
  const item = menuItems.find(m => {
    if (m.path === '/admin/dashboard') return route.path === '/admin/dashboard'
    return route.path.startsWith(m.path)
  })
  return item?.label || '工作台'
})

const menuItems = [
  {
    path: '/admin/dashboard',
    label: '工作台',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality', 'user'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'
  },
  {
    path: '/admin/tasks',
    label: '任务管理',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality', 'user'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  },
  {
    path: '/admin/task-new',
    label: '新建任务',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality', 'user'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
  },
  {
    path: '/admin/supervision',
    label: '督办中心',
    roles: ['admin', 'leader'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
  },
  {
    path: '/admin/showcase',
    label: '任务展示',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  },
  {
    path: '/admin/report',
    label: '报表统计',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>'
  },
  {
    path: '/admin/dictionary',
    label: '分类字典管理',
    roles: ['admin'],
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H4z"/><path d="M4 4v16"/></svg>'
  }
]

const visibleMenuItems = computed(() => {
  const role = authStore.user?.role
  if (!role) return []
  return menuItems.filter(item => item.roles.includes(role))
})

function handleLogout() {
  logout()
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; background: var(--bg); }

.sidebar {
  width: 240px; background: #001529; color: #fff;
  display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0;
  z-index: 100; transition: width 0.25s ease; overflow: hidden;
}
.sidebar.collapsed { width: 64px; }

.sidebar-logo {
  height: 64px; display: flex; align-items: center; padding: 0 20px; gap: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
}
.collapsed .sidebar-logo { justify-content: center; padding: 0; }
.logo-text { font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap; }

.sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; }

.nav-item {
  display: flex; align-items: center; padding: 0 24px; height: 44px; gap: 12px;
  color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px;
  position: relative; transition: color 0.2s, background 0.2s; cursor: pointer;
}
.collapsed .nav-item { justify-content: center; padding: 0; }
.nav-item:hover { color: #fff; background: rgba(255,255,255,0.06); }
.nav-item.active { color: #fff; background: rgba(255,255,255,0.08); }
.nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px; background: var(--primary); border-radius: 0 2px 2px 0;
}
.nav-icon { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0; }
.nav-icon :deep(svg) { display: block; }
.nav-label { white-space: nowrap; }

.sidebar-footer { border-top: 1px solid rgba(255,255,255,0.08); padding: 8px 0; }
.footer-link { color: rgba(255,255,255,0.45); }

.main-area { flex: 1; margin-left: 240px; display: flex; flex-direction: column; min-height: 100vh; transition: margin-left 0.25s ease; }
.sidebar.collapsed ~ .main-area { margin-left: 64px; }

.topbar {
  height: 64px; background: #fff; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 24px; position: sticky; top: 0; z-index: 150;
}
.collapse-btn {
  background: none; border: none; cursor: pointer; padding: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); border-radius: 4px; transition: background 0.2s;
}
.collapse-btn:hover { background: var(--bg); color: var(--text); }
.topbar-title { margin-left: 16px; font-size: 16px; font-weight: 600; color: var(--text); }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 16px; position: relative; }
.topbar-role { font-size: 12px; color: var(--primary); background: var(--primary-light); padding: 2px 8px; border-radius: 4px; }
.user-info { display: flex; align-items: center; gap: 8px; }
.avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500;
}
.user-name { font-size: 14px; color: var(--text); }
.content-area { flex: 1; padding: 24px; }

@media (max-width: 768px) {
  .sidebar { width: 64px; }
  .main-area { margin-left: 64px; }
  .sidebar-logo { padding: 0; justify-content: center; }
  .logo-text { display: none; }
  .nav-item { justify-content: center; padding: 0; }
  .nav-label { display: none; }
}

.topbar-logo { height: 36px; margin-right: 8px; object-fit: contain; }
.notif-bell-wrap { position: relative; }
.notif-bell { position: relative; cursor: pointer; padding: 6px; border-radius: 6px; transition: background 0.2s; color: var(--text-secondary); }
.notif-bell:hover { background: var(--bg); color: var(--text); }
.notif-badge { position: absolute; top: 2px; right: 2px; background: #ff4d4f; color: #fff; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.notif-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 360px; max-height: 400px; background: #fff; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.15); z-index: 400; overflow: hidden; border: 1px solid var(--border); }
.notif-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; }
.notif-mark-read { background: none; border: none; color: var(--primary); cursor: pointer; font-size: 12px; }
.notif-mark-read:hover { text-decoration: underline; }
.notif-empty { padding: 32px; text-align: center; color: var(--text-caption); font-size: 13px; }
.notif-list { max-height: 340px; overflow-y: auto; }
.notif-item { padding: 12px 16px; border-bottom: 1px solid #f5f5f5; cursor: pointer; transition: background 0.15s; }
.notif-item:hover { background: #fafbfc; }
.notif-item.unread { background: #f0f5ff; }
.notif-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.notif-content { font-size: 12px; color: var(--text-secondary); line-height: 1.4; white-space: pre-wrap; }
.notif-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-caption); margin-top: 6px; }
</style>
