<template>
  <div class="user-mgmt-page">
    <div class="page-header-row">
      <h2>账号及权限管理</h2>
      <button class="btn btn-primary" @click="openCreateDialog">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新增用户
      </button>
    </div>

    <!-- Filters -->
    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input v-model="searchText" type="text" placeholder="搜索姓名或用户名..." class="search-input" />
      </div>
      <select v-model="filterRole" class="form-select filter-select">
        <option value="">全部角色</option>
        <option v-for="(label, key) in roleMap" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <!-- User Table -->
    <div class="card table-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>姓名</th>
              <th>部门</th>
              <th>角色</th>
              <th>职务</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td class="cell-id">#{{ user.id }}</td>
              <td>{{ user.username }}</td>
              <td class="cell-name">{{ user.name }}</td>
              <td>{{ user.department }}</td>
              <td>
                <span class="tag" :class="'role-' + user.role">{{ roleMap[user.role] || user.role }}</span>
              </td>
              <td>{{ user.title }}</td>
              <td>
                <span class="status-dot" :class="{ active: user.active }"></span>
                {{ user.active ? '启用' : '禁用' }}
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm" @click="openEditDialog(user)">编辑</button>
                  <button v-if="user.active" class="btn btn-sm btn-danger" @click="toggleUser(user)">禁用</button>
                  <button v-else class="btn btn-sm btn-success" @click="toggleUser(user)">启用</button>
                  <button class="btn btn-sm btn-danger" @click="confirmHardDelete(user)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="showDialog = false">
      <div class="dialog">
        <h3>{{ editingUser ? '编辑用户' : '新增用户' }}</h3>
        <div class="form-group">
          <label class="form-label">用户名 <span class="req">*</span></label>
          <input v-model="form.username" class="form-input" :disabled="!!editingUser" placeholder="登录用户名" />
        </div>
        <div class="form-group" v-if="!editingUser">
          <label class="form-label">密码 <span class="req">*</span></label>
          <input v-model="form.password" type="password" class="form-input" placeholder="登录密码" />
        </div>
        <div class="form-group" v-if="editingUser">
          <label class="form-label">重置密码（留空不修改）</label>
          <input v-model="form.password" type="password" class="form-input" placeholder="新密码" />
        </div>
        <div class="form-group">
          <label class="form-label">姓名 <span class="req">*</span></label>
          <input v-model="form.name" class="form-input" placeholder="真实姓名" />
        </div>
        <div class="form-group">
          <label class="form-label">部门</label>
          <input v-model="form.department" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">角色 <span class="req">*</span></label>
          <select v-model="form.role" class="form-select">
            <option value="admin">管理员</option>
            <option value="leader">领导</option>
            <option value="supervisor_tech">技术主管</option>
            <option value="supervisor_quality">质量主管</option>
            <option value="staff_tech">技术员</option>
            <option value="staff_quality">质量员</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">职务</label>
          <input v-model="form.title" class="form-input" placeholder="如：研发主管" />
        </div>
        <div class="form-group">
          <label class="form-label">模块权限</label>
          <div class="module-check-grid">
            <label v-for="mod in allModules" :key="mod.id" class="module-check">
              <input type="checkbox" :value="mod.id" v-model="form.moduleIds" />
              <span>{{ mod.name }}</span>
            </label>
          </div>
        </div>
        <div v-if="formError" class="error-msg">{{ formError }}</div>
        <div class="dialog-actions">
          <button class="btn" @click="showDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { userAPI, moduleAPI } from '../../api/index.js'
import { roleMap } from '../../store/auth.js'

const users = ref([])
const searchText = ref('')
const filterRole = ref('')
const showDialog = ref(false)
const editingUser = ref(null)
const saving = ref(false)
const formError = ref('')
const allModules = ref([])

const form = reactive({
  username: '',
  password: '',
  name: '',
  department: '技术质量部',
  role: 'staff_tech',
  title: '',
  moduleIds: []
})

const filteredUsers = computed(() => {
  let result = users.value
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    result = result.filter(u => u.name.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw))
  }
  if (filterRole.value) {
    result = result.filter(u => u.role === filterRole.value)
  }
  return result
})

watch(showDialog, (v) => {
  document.body.classList.toggle('modal-open', v)
})

async function loadUsers() {
  try {
    const data = await userAPI.list()
    users.value = data.users
  } catch (e) {
    console.error('Failed to load users:', e)
  }
}

async function loadModules() {
  try {
    const data = await moduleAPI.list()
    allModules.value = data.modules
  } catch (e) {
    console.error('Failed to load modules:', e)
  }
}

function openCreateDialog() {
  editingUser.value = null
  form.username = ''
  form.password = ''
  form.name = ''
  form.department = '技术质量部'
  form.role = 'staff_tech'
  form.title = ''
  form.moduleIds = []
  formError.value = ''
  showDialog.value = true
}

function openEditDialog(user) {
  editingUser.value = user
  form.username = user.username
  form.password = ''
  form.name = user.name
  form.department = user.department
  form.role = user.role
  form.title = user.title
  form.moduleIds = (user.modules || []).map(m => m.id)
  formError.value = ''
  showDialog.value = true
}

async function handleSave() {
  formError.value = ''
  if (!form.name) { formError.value = '请输入姓名'; return }
  if (!editingUser.value && !form.username) { formError.value = '请输入用户名'; return }
  if (!editingUser.value && !form.password) { formError.value = '请输入密码'; return }

  saving.value = true
  try {
    if (editingUser.value) {
      const data = { name: form.name, role: form.role, title: form.title, department: form.department }
      if (form.password) data.password = form.password
      await userAPI.update(editingUser.value.id, data)
      await moduleAPI.setUserModules(editingUser.value.id, form.moduleIds)
    } else {
      const created = await userAPI.create({
        username: form.username,
        password: form.password,
        name: form.name,
        role: form.role,
        title: form.title,
        department: form.department
      })
      await moduleAPI.setUserModules(created.user.id, form.moduleIds)
    }
    showDialog.value = false
    await loadUsers()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function toggleUser(user) {
  try {
    if (user.active) {
      await userAPI.remove(user.id)
    } else {
      await userAPI.update(user.id, { active: true })
    }
    await loadUsers()
  } catch (e) {
    alert(e.message)
  }
}

async function confirmHardDelete(user) {
  if (!confirm(`确定要永久删除用户「${user.name}」吗？此操作不可恢复。`)) return
  try {
    await userAPI.hardDelete(user.id)
    await loadUsers()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => {
  loadUsers()
  loadModules()
})
</script>

<style scoped>
.user-mgmt-page { display: flex; flex-direction: column; gap: 20px; }
.page-header-row { display: flex; justify-content: space-between; align-items: center; }
.page-header-row h2 { font-size: 20px; font-weight: 600; color: var(--text); margin: 0; }

.toolbar { display: flex; gap: 12px; align-items: center; }
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  flex: 1;
  max-width: 360px;
}
.search-box svg { color: var(--text-secondary); flex-shrink: 0; }
.search-input { border: none; outline: none; font-size: 14px; color: var(--text); background: transparent; width: 100%; }
.filter-select { width: 140px; }

.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  text-align: left;
  padding: 12px 14px;
  color: var(--text-secondary);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  background: #fafbfc;
  white-space: nowrap;
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f5f7fa; color: var(--text); }
.data-table tbody tr:hover { background: #fafbfc; }
.cell-id { color: var(--text-secondary); font-family: monospace; }
.cell-name { font-weight: 500; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.role-admin { color: #ff4d4f; background: #fff2f0; }
.role-leader { color: #fa8c16; background: #fff7e6; }
.role-supervisor_tech { color: #1677ff; background: #e6f4ff; }
.role-supervisor_quality { color: #722ed1; background: #f9f0ff; }
.role-staff_tech { color: #13c2c2; background: #e6fffb; }
.role-staff_quality { color: #52c41a; background: #f6ffed; }

.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ccc; margin-right: 6px; vertical-align: middle; }
.status-dot.active { background: #52c41a; }

.action-btns { display: flex; gap: 6px; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
  transition: all 0.2s;
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff2f0; }
.btn-success { color: #52c41a; border-color: #52c41a; }
.btn-success:hover { background: #f6ffed; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.form-select {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 32px 0 10px;
  font-size: 13px;
  color: var(--text);
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none;
  cursor: pointer;
  outline: none;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  border-radius: var(--radius);
  padding: 28px;
  width: 480px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
.dialog h3 { margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: var(--text); }
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.req { color: #ff4d4f; }
.form-input, .dialog .form-select {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text);
  outline: none;
  box-sizing: border-box;
  background: #fff;
}
.form-input:focus, .dialog .form-select:focus { border-color: var(--primary); }
.error-msg { color: #ff4d4f; font-size: 13px; margin-bottom: 12px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.module-check-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.module-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}
</style>