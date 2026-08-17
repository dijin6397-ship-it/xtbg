<template>
  <div class="page">
    <div class="page-header">
      <h1>发布任务</h1>
      <p>创建并分配新任务</p>
    </div>

    <div class="card" style="margin-top: 12px">
      <!-- Flow Type Selection -->
      <div class="form-group">
        <label class="form-label">任务流程 *</label>
        <div class="flow-type-list">
          <div
            v-for="f in flowTypes"
            :key="f.value"
            class="flow-type-item"
            :class="{ active: form.flow_type === f.value }"
            @click="selectFlow(f.value)"
          >
            <div class="flow-type-dot" :style="{ background: f.color }"></div>
            <div>
              <div class="flow-type-name">{{ f.label }}</div>
              <div class="flow-type-desc">{{ f.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project flow: sub-type selection -->
      <div v-if="form.flow_type === 'project'" class="form-group">
        <label class="form-label">任务类型 *</label>
        <select class="form-select" v-model="form.task_type">
          <option value="" disabled>请选择</option>
          <option value="self_repair">自主修</option>
          <option value="rectification">问题整改</option>
          <option value="quality_analysis">现场质量问题分析</option>
        </select>
      </div>

      <!-- Daily management: dictionary selection -->
      <div v-if="form.flow_type === 'daily_management'" class="form-group">
        <label class="form-label">数据字典 *</label>
        <div class="dict-grid">
          <div
            v-for="d in dictOptions"
            :key="d"
            class="dict-item"
            :class="{ active: form.management_category === d }"
            @click="form.management_category = d"
          >{{ d }}</div>
        </div>
        <div v-if="form.management_category === '其他'" class="form-group" style="margin-top: 10px">
          <label class="form-label">其他说明 *</label>
          <input class="form-input" v-model="form.management_detail" placeholder="请具体说明" />
        </div>
      </div>

      <!-- Key work: executor selection -->
      <div v-if="form.flow_type === 'key_work'" class="form-group">
        <label class="form-label">指派执行人 *</label>
        <select class="form-select" v-model="form.assignee_id">
          <option :value="null" disabled>请选择执行人</option>
          <option v-for="u in techQualityUsers" :key="u.id" :value="u.id">
            {{ u.name }}{{ u.title ? ' - ' + u.title : '' }}
          </option>
        </select>
      </div>

      <!-- Title (project and key_work) -->
      <div v-if="form.flow_type && form.flow_type !== 'daily_management'" class="form-group">
        <label class="form-label">任务标题 *</label>
        <input class="form-input" v-model="form.title" placeholder="请输入任务标题" />
      </div>

      <!-- Description (all flows) -->
      <div v-if="form.flow_type" class="form-group">
        <label class="form-label">任务描述 *</label>
        <textarea class="form-textarea" v-model="form.description" placeholder="请输入任务描述"></textarea>
      </div>

      <!-- Deadline (project and key_work) -->
      <div v-if="form.flow_type && form.flow_type !== 'daily_management'" class="form-group">
        <label class="form-label">截止日期 <span class="required">*</span></label>
        <input class="form-input" type="date" v-model="form.deadline" />
      </div>

      <!-- Deadline (daily_management) -->
      <div v-if="form.flow_type === 'daily_management'" class="form-group">
        <label class="form-label">截止日期 <span class="required">*</span></label>
        <input class="form-input" type="date" v-model="form.deadline" />
      </div>

      <!-- Submit -->
      <button class="btn btn-primary" @click="handlePublish" :disabled="!isValid || publishing" style="margin-top: 8px">
        {{ publishing ? '发布中...' : '发布任务' }}
      </button>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccess" class="slide-panel">
      <div class="slide-overlay" @click="showSuccess = false"></div>
      <div class="slide-content" style="padding: 32px 24px; text-align: center">
        <div class="m-success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px">任务发布成功</h2>
        <p style="color: var(--text-secondary); margin-bottom: 20px">任务已通知相关责任人</p>
        <div style="display: flex; gap: 10px; justify-content: center">
          <button class="btn btn-outline" @click="goTaskList" style="flex: 1; max-width: 140px">查看任务</button>
          <button class="btn btn-primary" @click="resetForm" style="flex: 1; max-width: 140px">继续发布</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { taskAPI, userAPI } from '../../api/index.js'
import { authStore, canCreateProjectTask, canCreateKeyWorkTask, canCreateDailyManagementTask } from '../../store/auth.js'

const router = useRouter()
const publishing = ref(false)
const showSuccess = ref(false)
const allUsers = ref([])

const techQualityUsers = computed(() => {
  return allUsers.value.filter(u => u.department === '技术质量部')
})

const allFlowTypes = [
  { value: 'project', label: '项目任务', desc: '自主修/问题整改/质量分析', color: '#1677ff', roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'] },
  { value: 'key_work', label: '部门重点工作', desc: '领导直接指派执行人', color: '#13c2c2', roles: ['admin', 'leader'] },
  { value: 'daily_management', label: '部门日常管理', desc: '全员可发起，按类别管理', color: '#faad14', roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality'] }
]
const flowTypes = computed(() => {
  const role = authStore.user?.role
  if (!role) return []
  return allFlowTypes.filter(f => f.roles.includes(role))
})

const dictOptions = ['固资', '安全', '合同', '制度管理', '体系内外审', '信息化', '绩效', '考勤', '报销', '其他']

const form = reactive({
  flow_type: '',
  task_type: '',
  title: '',
  description: '',
  deadline: '',
  assignee_id: null,
  management_category: '',
  management_detail: ''
})

function selectFlow(value) {
  form.flow_type = value
  if (value === 'project') {
    form.task_type = ''
  } else if (value === 'key_work') {
    form.task_type = 'key_work'
    form.assignee_id = null
  } else if (value === 'daily_management') {
    form.task_type = 'daily_management'
    form.management_category = ''
    form.management_detail = ''
  }
  form.title = ''
  form.description = ''
  form.deadline = ''
}

const isValid = computed(() => {
  if (!form.flow_type) return false
  if (!form.deadline) return false  // Deadline required for ALL flows
  if (form.flow_type === 'project') {
    return form.task_type && form.title.trim() && form.description.trim()
  }
  if (form.flow_type === 'key_work') {
    return form.assignee_id && form.description.trim()
  }
  if (form.flow_type === 'daily_management') {
    if (!form.management_category) return false
    if (form.management_category === '其他' && !form.management_detail.trim()) return false
    return form.description.trim()
  }
  return false
})

async function handlePublish() {
  if (!isValid.value) return
  publishing.value = true
  try {
    const taskData = {
      task_type: form.task_type,
      title: form.flow_type === 'daily_management'
        ? form.management_category + '日常管理'
        : form.title.trim(),
      description: form.description.trim(),
      deadline: form.deadline || null
    }
    if (form.flow_type === 'key_work') {
      taskData.assignee_id = form.assignee_id
    }
    if (form.flow_type === 'daily_management') {
      taskData.management_category = form.management_category
      taskData.management_detail = form.management_detail.trim()
    }
    await taskAPI.create(taskData)
    showSuccess.value = true
  } catch (e) {
    alert(e.message)
  } finally {
    publishing.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    flow_type: '', task_type: '', title: '', description: '', deadline: '',
    assignee_id: null, management_category: '', management_detail: ''
  })
  showSuccess.value = false
}

function goTaskList() {
  showSuccess.value = false
  router.push('/m/tasks')
}

onMounted(async () => {
  try {
    const data = await userAPI.list()
    allUsers.value = data.users
  } catch (e) {
    console.error('Failed to load users:', e)
  }
})
</script>

<style scoped>
.m-success-icon { margin-bottom: 12px; }

.flow-type-list { display: flex; flex-direction: column; gap: 8px; }
.flow-type-item {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
  transition: all 0.2s;
}
.flow-type-item.active { border-color: var(--primary); background: var(--primary-light); }
.flow-type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.flow-type-name { font-size: 14px; font-weight: 500; color: var(--text); }
.flow-type-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.dict-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dict-item {
  padding: 10px 6px; text-align: center; border: 1px solid var(--border);
  border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.dict-item.active { border-color: var(--primary); background: var(--primary); color: #fff; }
.required { color: var(--danger); }
</style>