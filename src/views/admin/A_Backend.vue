<template>
  <div class="backend-page">
    <div class="page-header">
      <h2>后台管理</h2>
      <span class="summary">账号权限与基础数据维护</span>
    </div>

    <!-- 无后台管理模块权限时的提示 -->
    <div v-if="!canAccessBackend" class="card no-access">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <p>您没有「后台管理」模块权限</p>
      <span>如需使用，请联系管理员在账号管理中为您开启该模块权限。</span>
    </div>

    <template v-else>
      <!-- 标签页切换 -->
      <div class="tabs">
        <button
          v-for="tab in visibleTabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-icon" v-html="tab.icon"></span>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- 账号管理 -->
      <div v-if="activeTab === 'users'" class="tab-panel">
        <A_UserManagement />
      </div>

      <!-- WBS 字典维护 -->
      <div v-if="activeTab === 'wbs'" class="tab-panel">
        <A_WbsDictionary />
      </div>

      <!-- 分类字典管理 -->
      <div v-if="activeTab === 'dictionary'" class="tab-panel">
        <A_Dictionary />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { canAccessBackend } from '../../store/auth.js'
import A_UserManagement from './A_UserManagement.vue'
import A_WbsDictionary from './A_WbsDictionary.vue'
import A_Dictionary from './A_Dictionary.vue'

const activeTab = ref('users')

// 三个标签页均属于「后台管理」模块，
// 凡拥有 admin_backend 模块权限的账号（含管理员）都可见、可用。
const allTabs = [
  {
    key: 'users',
    label: '账号管理',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  },
  {
    key: 'wbs',
    label: 'WBS字典维护',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M10 6.5h4a3 3 0 0 1 3 3v4"/></svg>'
  },
  {
    key: 'dictionary',
    label: '分类字典管理',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H4z"/><path d="M4 4v16"/></svg>'
  }
]

const visibleTabs = computed(() => allTabs)

// 默认落在「账号管理」
watch(visibleTabs, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = tabs[0]?.key || 'users'
  }
}, { immediate: true })

onMounted(() => {
  // 保持默认「账号管理」标签
})
</script>

<style scoped>
.backend-page { display: flex; flex-direction: column; gap: 16px; }
.page-header {
  display: flex; align-items: baseline; gap: 12px; background: #fff; color: #000;
  padding: 16px; border-radius: var(--radius); border-bottom: 1px solid var(--border);
}
.page-header h2 { font-size: 20px; font-weight: 600; color: #000; margin: 0; }
.summary { font-size: 13px; color: var(--text-secondary); }

.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); padding: 24px; }

.no-access {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 60px 24px; color: var(--text-secondary); text-align: center;
}
.no-access svg { color: var(--text-caption); }
.no-access p { margin: 0; font-size: 15px; font-weight: 500; color: var(--text); }
.no-access span { font-size: 13px; }

.tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.tab-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
  transition: all 0.2s;
}
.tab-btn:hover { border-color: var(--primary); color: var(--primary); }
.tab-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.tab-icon { display: inline-flex; align-items: center; }
.tab-panel { display: block; }
</style>
