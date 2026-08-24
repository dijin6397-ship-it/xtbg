<template>
  <div class="publish-page">
    <h2 class="page-title">新建任务</h2>

    <div class="publish-form">
      <div class="form-left">
        <div class="card">
          <!-- Step 1: Select Flow Type -->
          <div class="form-group">
            <label class="form-label">任务流程 <span class="required">*</span></label>
            <div class="flow-cards">
              <div
                v-for="f in availableFlowTypes"
                :key="f.value"
                class="type-card"
                :class="{ active: form.flow_type === f.value }"
                @click="selectFlow(f.value)"
              >
                <div class="type-icon" :style="{ background: f.bg, color: f.color }">
                  <span v-html="f.icon"></span>
                </div>
                <div class="type-info">
                  <div class="type-name">{{ f.label }}</div>
                  <div class="type-desc">{{ f.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Select task_type for project flows -->
          <div v-if="form.flow_type === 'project'" class="form-group">
            <label class="form-label">任务类型 <span class="required">*</span></label>
            <div class="type-cards">
              <div
                v-for="t in projectTypes"
                :key="t.value"
                class="type-card type-card-sm"
                :class="{ active: form.task_type === t.value }"
                @click="form.task_type = t.value"
              >
                <div class="type-icon" :style="{ background: t.bg, color: t.color }">
                  <span v-html="t.icon"></span>
                </div>
                <div class="type-info">
                  <div class="type-name">{{ t.label }}</div>
                  <div class="type-desc">{{ t.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Daily Management: select dictionary category -->
          <div v-if="form.flow_type === 'daily_management'" class="form-group">
            <label class="form-label">数据字典 <span class="required">*</span></label>
            <div class="dict-grid">
              <div
                v-for="d in dictOptions"
                :key="d"
                class="dict-item"
                :class="{ active: form.management_category === d }"
                @click="form.management_category = d"
              >
                {{ d }}
              </div>
            </div>
            <div v-if="form.management_category === '其他'" class="form-group" style="margin-top: 12px">
              <label class="form-label">其他说明 <span class="required">*</span></label>
              <input v-model="form.management_detail" type="text" class="form-input" placeholder="请具体说明" />
            </div>
          </div>

          <!-- Key Work: select executor -->
          <div v-if="form.flow_type === 'key_work'" class="form-group">
            <label class="form-label">指派执行人 <span class="required">*</span></label>
            <select v-model="form.assignee_id" class="form-select">
              <option :value="null" disabled>请选择执行人</option>
              <option v-for="u in techQualityUsers" :key="u.id" :value="u.id">
                {{ u.name }}{{ u.title ? ' - ' + u.title : '' }}{{ u.department ? ' (' + u.department + ')' : '' }}
              </option>
            </select>
          </div>

          <!-- Title (for project and key_work flows) -->
          <div v-if="form.flow_type && form.flow_type !== 'daily_management'" class="form-group">
            <label class="form-label">任务标题 <span class="required">*</span></label>
            <input v-model="form.title" type="text" class="form-input" placeholder="请输入任务标题" />
          </div>

          <!-- Description (all flows) -->
          <div v-if="form.flow_type" class="form-group">
            <label class="form-label">任务描述 <span class="required">*</span></label>
            <textarea v-model="form.description" class="form-textarea" rows="5" placeholder="请输入任务描述"></textarea>
          </div>

          <!-- Deadline (project and key_work flows) -->
          <div v-if="form.flow_type && form.flow_type !== 'daily_management'" class="form-group">
            <label class="form-label">截止日期 <span class="required">*</span></label>
            <input v-model="form.deadline" type="date" class="form-input" />
          </div>

          <!-- Deadline (daily_management) -->
          <div v-if="form.flow_type === 'daily_management'" class="form-group">
            <label class="form-label">截止日期 <span class="required">*</span></label>
            <input v-model="form.deadline" type="date" class="form-input" />
          </div>
        </div>
      </div>

      <div class="form-right">
        <div class="card">
          <h3 class="section-title">流程预览</h3>
          <div class="flow-preview" v-if="form.flow_type">
            <!-- Project flow -->
            <template v-if="form.flow_type === 'project'">
              <div class="flow-step">
                <div class="flow-dot active"></div>
                <div class="flow-content">
                  <div class="flow-label">发起人</div>
                  <div class="flow-value">{{ authStore.user?.name }}</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot"></div>
                <div class="flow-content">
                  <div class="flow-label">主管</div>
                  <div class="flow-value">分配子任务</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot"></div>
                <div class="flow-content">
                  <div class="flow-label">执行人</div>
                  <div class="flow-value">执行并提交输出物</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot"></div>
                <div class="flow-content">
                  <div class="flow-label">主管审核</div>
                  <div class="flow-value">审核输出物</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot final"></div>
                <div class="flow-content">
                  <div class="flow-label">领导</div>
                  <div class="flow-value">最终反馈</div>
                </div>
              </div>
            </template>

            <!-- Key work flow -->
            <template v-if="form.flow_type === 'key_work'">
              <div class="flow-step">
                <div class="flow-dot active"></div>
                <div class="flow-content">
                  <div class="flow-label">领导</div>
                  <div class="flow-value">{{ authStore.user?.name }}</div>
                  <div class="flow-note">指派执行人</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot"></div>
                <div class="flow-content">
                  <div class="flow-label">执行人</div>
                  <div class="flow-value">执行并反馈输出物</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot final"></div>
                <div class="flow-content">
                  <div class="flow-label">领导审核</div>
                  <div class="flow-value">直接审核完成</div>
                </div>
              </div>
            </template>

            <!-- Daily management flow -->
            <template v-if="form.flow_type === 'daily_management'">
              <div class="flow-step">
                <div class="flow-dot active"></div>
                <div class="flow-content">
                  <div class="flow-label">发起人</div>
                  <div class="flow-value">{{ authStore.user?.name }}</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot"></div>
                <div class="flow-content">
                  <div class="flow-label">自行管理</div>
                  <div class="flow-value">按类别执行任务</div>
                </div>
              </div>
              <div class="flow-line"></div>
              <div class="flow-step">
                <div class="flow-dot final"></div>
                <div class="flow-content">
                  <div class="flow-label">反馈输出物</div>
                  <div class="flow-value">自行反馈完成</div>
                </div>
              </div>
            </template>
          </div>
          <div v-else class="flow-hint">请先选择任务流程</div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-outline" @click="$router.back()">取消</button>
      <button class="btn btn-primary" @click="handlePublish" :disabled="!isValid || publishing">
        {{ publishing ? '发布中...' : '发布任务' }}
      </button>
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
const allUsers = ref([])

const techQualityUsers = computed(() => {
  return allUsers.value.filter(u => u.department === '技术质量部')
})

const flowTypes = [
  {
    value: 'project', label: '项目任务', desc: '自主修/问题整改/质量分析',
    bg: '#e6f4ff', color: '#1677ff',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    roles: ['admin', 'supervisor_tech', 'supervisor_quality']
  },
  {
    value: 'key_work', label: '部门重点工作', desc: '领导直接指派执行人',
    bg: '#e6fffb', color: '#13c2c2',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    roles: ['admin', 'leader']
  },
  {
    value: 'daily_management', label: '部门日常管理', desc: '全员可发起，按类别管理',
    bg: '#fffbe6', color: '#faad14',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality']
  }
]

const availableFlowTypes = computed(() => {
  const role = authStore.user?.role
  if (!role) return []
  return flowTypes.filter(f => f.roles.includes(role))
})

const projectTypes = [
  {
    value: 'self_repair', label: '自主修', desc: '设备自主维修保养',
    bg: '#e6f4ff', color: '#1677ff',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  },
  {
    value: 'rectification', label: '问题整改', desc: '问题跟踪整改',
    bg: '#fff7e6', color: '#fa8c16',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  },
  {
    value: 'quality_analysis', label: '现场质量问题分析', desc: '质量问题分析改进',
    bg: '#f9f0ff', color: '#722ed1',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  }
]

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
        ? `${form.management_category}日常管理`
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
    router.push('/admin/tasks')
  } catch (e) {
    alert(e.message)
  } finally {
    publishing.value = false
  }
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
.publish-page { max-width: 1200px; }
.page-title { font-size: 20px; font-weight: 600; color: var(--text); margin: 0 0 20px 0; }
.publish-form { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }

.card {
  background: #fff; border-radius: var(--radius); padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.section-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px 0; }

.form-group { margin-bottom: 18px; }
.form-group:last-child { margin-bottom: 0; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 8px; }
.required { color: var(--danger); }

.form-input, .form-select, .form-textarea {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; font-size: 14px; color: var(--text); background: #fff;
  outline: none; transition: border-color 0.2s; box-sizing: border-box;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--primary); }
.form-textarea { resize: vertical; font-family: inherit; min-height: 100px; }

.flow-cards { display: flex; flex-direction: column; gap: 10px; }
.type-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  border: 2px solid var(--border); border-radius: 10px; cursor: pointer;
  transition: all 0.2s;
}
.type-card:hover { border-color: #c9cdd4; }
.type-card.active { border-color: var(--primary); background: var(--primary-light); }
.type-card-sm { padding: 10px 14px; }
.type-icon {
  width: 40px; height: 40px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.type-card-sm .type-icon { width: 34px; height: 34px; }
.type-info { flex: 1; }
.type-name { font-size: 15px; font-weight: 600; color: var(--text); }
.type-card-sm .type-name { font-size: 14px; }
.type-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.dict-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.dict-item {
  padding: 10px 8px; text-align: center; border: 1px solid var(--border);
  border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.2s;
  color: var(--text); background: #fff;
}
.dict-item:hover { border-color: var(--primary); color: var(--primary); }
.dict-item.active { border-color: var(--primary); background: var(--primary); color: #fff; }

.flow-preview { display: flex; flex-direction: column; }
.flow-step { display: flex; align-items: flex-start; gap: 12px; padding: 4px 0; }
.flow-dot {
  width: 12px; height: 12px; border-radius: 50%; background: #d9d9d9;
  border: 2px solid #d9d9d9; flex-shrink: 0; margin-top: 4px;
}
.flow-dot.active { background: var(--primary); border-color: var(--primary); }
.flow-dot.final { background: var(--success); border-color: var(--success); }
.flow-line { width: 2px; height: 16px; background: #e5e6eb; margin-left: 5px; }
.flow-content { flex: 1; }
.flow-label { font-size: 12px; color: var(--text-secondary); }
.flow-value { font-size: 14px; font-weight: 500; color: var(--text); margin-top: 2px; }
.flow-note { font-size: 11px; color: var(--text-caption); margin-top: 2px; }
.flow-hint { text-align: center; color: var(--text-caption); font-size: 13px; padding: 20px; }

.form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
  transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn-outline { background: #fff; }
.btn-outline:hover { border-color: var(--primary); color: var(--primary); }

@media (max-width: 900px) {
  .publish-form { grid-template-columns: 1fr; }
  .dict-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>