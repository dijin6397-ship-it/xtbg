<template>
  <div class="page-wrap" v-if="task">
    <button class="back-btn" @click="$router.push(`/admin/task/${task.id}`)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      返回任务详情
    </button>

    <h2 class="page-title">任务分解与分配</h2>
    <p class="page-desc">{{ task.title }}</p>

    <div class="card">
      <h3 class="card-title">任务摘要</h3>
      <div class="form-group">
        <label class="form-label">任务标题 <span class="required">*</span></label>
        <input class="form-input" v-model="editTitle" placeholder="请输入任务标题" />
      </div>
      <div class="form-group">
        <label class="form-label">任务描述</label>
        <textarea class="form-textarea" v-model="editDesc" rows="4" placeholder="请输入任务详细描述..."></textarea>
      </div>
      <div class="meta-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">截止日期 <span class="required">*</span></label>
          <input class="form-input" type="date" v-model="editDeadline" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">任务类型</label>
          <span class="tag" :style="{ color: taskTypeMap[task.task_type]?.color, background: taskTypeMap[task.task_type]?.bg }">
            {{ taskTypeMap[task.task_type]?.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Existing subtasks -->
    <div class="card" v-if="task.subtasks?.length">
      <h3 class="card-title">已有子任务 ({{ task.subtasks.length }})</h3>
      <div class="subtask-table">
        <div v-for="sub in task.subtasks" :key="sub.id" class="subtask-row">
          <div class="subtask-left">
            <div class="avatar-sm">{{ sub.assignee?.name?.charAt(0) || '?' }}</div>
            <div>
              <div class="subtask-name">{{ sub.title }}</div>
              <div class="subtask-person">{{ sub.assignee?.name || '未分配' }}</div>
            </div>
          </div>
          <div class="subtask-right">
            <span class="tag" :style="{ color: statusMap[sub.status]?.color, background: statusMap[sub.status]?.bg }">{{ statusMap[sub.status]?.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Subtask Form -->
    <div class="card">
      <h3 class="card-title">添加子任务</h3>
      <p class="card-hint">
        {{ isQualityType ? '请选择质量员分配子任务' : '请选择技术员分配子任务' }}
      </p>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">子任务标题</label>
          <input class="form-input" v-model="newTitle" placeholder="请输入子任务标题" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">{{ isQualityType ? '质量员' : '技术员' }}</label>
          <select class="form-select" v-model="newAssigneeId">
            <option :value="null" disabled>请选择</option>
            <option v-for="u in availableStaff" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div class="form-group" style="flex:0;align-self:flex-end">
          <button class="btn btn-primary" @click="addSub" :disabled="!canAdd">添加</button>
        </div>
      </div>

      <!-- Pending subtasks -->
      <div v-if="pendingSubtasks.length" class="pending-list">
        <div v-for="(st, i) in pendingSubtasks" :key="i" class="pending-item">
          <span>{{ st.title }} → {{ st.assignee_name }}</span>
          <span class="remove-btn" @click="pendingSubtasks.splice(i, 1)">×</span>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-outline" @click="$router.push(`/admin/task/${task.id}`)">取消</button>
      <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting || !canSubmit">
        {{ submitting ? '提交中...' : '确认分配' }}
      </button>
    </div>
  </div>

  <div v-else class="empty-state" style="padding:100px 0;text-align:center">
    {{ loading ? '加载中...' : '任务不存在' }}
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { taskAPI, userAPI } from '../../api/index.js'
import { taskTypeMap } from '../../store/auth.js'

const route = useRoute()
const router = useRouter()
const task = ref(null)
const loading = ref(true)
const submitting = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const editDeadline = ref('')
const newTitle = ref('')
const newAssigneeId = ref(null)
const allUsers = ref([])
const pendingSubtasks = ref([])

const statusMap = {
  pending: { label: '待开始', color: '#8c8c8c', bg: '#f5f5f5' },
  in_progress: { label: '进行中', color: '#1677ff', bg: '#e6f4ff' },
  completed: { label: '已完成', color: '#52c41a', bg: '#f6ffed' }
}

const isQualityType = computed(() => task.value?.task_type === 'quality_analysis')

const availableStaff = computed(() => {
  const role = isQualityType.value ? 'staff_quality' : 'staff_tech'
  return allUsers.value.filter(u => u.role === role && u.active)
})

const canAdd = computed(() => newTitle.value.trim() && newAssigneeId.value !== null)

const canSubmit = computed(() => editTitle.value.trim() && editDeadline.value)

function addSub() {
  if (!canAdd.value) return
  const user = availableStaff.value.find(u => u.id === newAssigneeId.value)
  if (!user) return
  pendingSubtasks.value.push({ title: newTitle.value.trim(), assignee_id: user.id, assignee_name: user.name })
  newTitle.value = ''
  newAssigneeId.value = null
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    // Update task details
    await taskAPI.update(task.value.id, {
      title: editTitle.value.trim(),
      description: editDesc.value.trim(),
      deadline: editDeadline.value
    })

    // Add subtasks
    if (pendingSubtasks.value.length > 0) {
      await taskAPI.addSubtasks(task.value.id, pendingSubtasks.value)
    }

    // Assign users
    const assigneeIds = [...new Set(pendingSubtasks.value.map(s => s.assignee_id))]
    if (assigneeIds.length > 0) {
      await taskAPI.assign(task.value.id, { assignee_ids: assigneeIds })
    }

    router.push(`/admin/task/${task.value.id}`)
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const [taskData, userData] = await Promise.all([
      taskAPI.get(Number(route.params.id)),
      userAPI.list()
    ])
    task.value = taskData.task
    editTitle.value = task.value.title || ''
    editDesc.value = task.value.description || ''
    editDeadline.value = task.value.deadline || ''
    allUsers.value = userData.users
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-wrap { max-width: 800px; }
.back-btn {
  display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
  cursor: pointer; color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; padding: 0;
}
.back-btn:hover { color: var(--primary); }
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 4px 0; }
.page-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0; }

.card { background: #fff; border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 10px 0; }
.card-hint { font-size: 12px; color: var(--text-secondary); margin: 0 0 14px 0; }
.desc { font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin: 0 0 10px 0; }
.meta-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
.tag { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.required { color: var(--danger); }

.form-group { margin-bottom: 14px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.form-input, .form-select, .form-textarea {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; font-size: 13px; outline: none; background: #fff;
  box-sizing: border-box;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--primary); }
.form-textarea { resize: vertical; font-family: inherit; min-height: 80px; }

.subtask-table { display: flex; flex-direction: column; gap: 8px; }
.subtask-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafbfc; border-radius: 8px; }
.subtask-left { display: flex; align-items: center; gap: 10px; }
.avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: #722ed1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.subtask-name { font-size: 13px; font-weight: 500; color: var(--text); }
.subtask-person { font-size: 12px; color: var(--text-secondary); }

.form-row { display: flex; gap: 12px; align-items: flex-end; }
.form-row .form-group { margin-bottom: 0; }

.pending-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.pending-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f6ffed; border-radius: 6px; font-size: 13px; }
.remove-btn { cursor: pointer; color: var(--danger); font-size: 16px; padding: 0 4px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn-outline { background: #fff; }
.btn-outline:hover { border-color: var(--primary); color: var(--primary); }

.action-bar { display: flex; justify-content: flex-end; gap: 12px; padding: 8px 0; }
.empty-state { color: var(--text-secondary); font-size: 14px; }
</style>
