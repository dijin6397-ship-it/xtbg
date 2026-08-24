<template>
  <div class="task-detail" v-if="task">
    <div class="detail-left">
      <button class="back-btn" @click="$router.push('/admin/tasks')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        返回列表
      </button>

      <h1 class="task-title">{{ task.title }}</h1>

      <div class="tags-row">
        <span class="tag" :style="{ color: taskTypeMap[task.task_type]?.color, background: taskTypeMap[task.task_type]?.bg }">
          {{ taskTypeMap[task.task_type]?.label }}
        </span>
        <span class="tag" :style="{ color: priorityMap[task.priority]?.color, background: priorityMap[task.priority]?.bg }">
          {{ priorityMap[task.priority]?.label }}
        </span>
        <span class="tag" :style="{ color: statusMap[task.status]?.color, background: statusMap[task.status]?.bg }">
          {{ statusMap[task.status]?.label }}
        </span>
      </div>

      <div class="progress-section">
        <div class="progress-header"><span>总进度</span><span>{{ task.progress }}%</span></div>
        <div class="progress-bar" style="width: 100%; height: 8px;">
          <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: task.progress === 100 ? 'var(--success)' : 'var(--primary)' }"></div>
        </div>
      </div>

      <div class="desc-section" v-if="task.description">
        <h3>任务描述</h3>
        <p>{{ task.description }}</p>
      </div>

      <!-- Subtasks -->
      <div class="section" v-if="task.subtasks?.length">
        <h3>子任务 ({{ task.subtasks.length }})</h3>
        <div class="subtask-list">
          <div v-for="sub in task.subtasks" :key="sub.id" class="subtask-item">
            <div class="subtask-info">
              <span class="subtask-title">{{ sub.title }}</span>
              <span class="subtask-assignee">{{ sub.assignee?.name || '未分配' }}</span>
            </div>
            <div class="subtask-right">
              <span class="tag tag-sm" :style="{ color: statusMap[sub.status]?.color, background: statusMap[sub.status]?.bg }">{{ statusMap[sub.status]?.label }}</span>
              <div class="progress-bar" style="width:80px;height:4px">
                <div class="progress-bar-fill" :style="{ width: sub.progress + '%', background: 'var(--primary)' }"></div>
              </div>
              <span class="progress-text">{{ sub.progress }}%</span>
              <span v-if="sub.deadline" class="subtask-deadline" :class="{ 'text-danger': new Date(sub.deadline) < new Date() && sub.status !== 'completed' }">{{ sub.deadline }}</span>
              <button v-if="canSupervise && (isOverdue || task.status === 'overdue') && sub.status !== 'completed'" class="btn btn-sm btn-urge" @click="handleSubtaskUrge(sub.id)" title="催办">📢</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Outputs -->
      <div class="section" v-if="task.outputs?.length">
        <h3>输出物 ({{ task.outputs.length }})</h3>
        <div class="output-list">
          <div v-for="out in task.outputs" :key="out.id" class="output-item" :class="'output-' + out.status">
            <div class="output-header">
              <span class="output-user">{{ out.submitter?.name }}</span>
              <span class="output-time">{{ out.createdAt }}</span>
              <span class="tag tag-sm" :class="'output-status-' + out.status">
                {{ { pending: '待审核', approved: '已通过', rejected: '已退回' }[out.status] }}
              </span>
              <button v-if="out.status === 'pending' && canRecallOutput(out)" class="btn btn-sm btn-danger" @click="handleRecallOutput(out.id)">
                撤回
              </button>
            </div>
            <div class="output-content">{{ out.content }}</div>
            <div v-if="out.categoryL1Name || out.categoryL3Name" class="output-category">
              <span class="cat-text">{{ out.categoryL1Name }} / {{ out.categoryL2Name }} / {{ out.categoryL3Name }}</span>
            </div>
            <div v-if="out.scoreRule" class="output-score-ref">
              <span class="tag" :class="ruleClass(out.scoreRule)">{{ ruleLabel(out.scoreRule) }}</span>
              <span v-if="out.scoreRule === 'fixed'" class="score-ref-text">参考分值 ≤ {{ out.refScoreValue }}</span>
              <span v-if="out.scoreRule === 'range'" class="score-ref-text">参考分值 {{ out.refScoreValue }} - {{ out.refScoreUpper }}</span>
              <span v-if="out.scoreRule === 'any'" class="score-ref-text">任意分值</span>
            </div>
            <div v-if="out.scoreTotal !== undefined && out.scoreTotal !== null && out.scoreTotal > 0" class="output-score">
              <span class="score-label">分值：</span>
              <span class="score-text">{{ out.scoreValue }} × {{ out.scoreQuantity }} = <strong>{{ out.scoreTotal }}</strong></span>
              <span class="output-rule" v-if="out.scoreRule">({{ ruleLabel(out.scoreRule) }})</span>
            </div>
            <div v-if="out.reviewComment" class="output-review">
              审核意见: {{ out.reviewComment }}
              <span v-if="out.reviewer"> — {{ out.reviewer.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feedbacks -->
      <div class="section">
        <h3>反馈动态</h3>
        <div v-if="!task.feedbacks?.length" class="empty-hint">暂无反馈</div>
        <div class="feedback-list">
          <div v-for="fb in task.feedbacks" :key="fb.id" class="feedback-item">
            <div class="fb-avatar">{{ fb.user?.name?.charAt(0) || '?' }}</div>
            <div class="fb-body">
              <div class="fb-header">
                <span class="fb-name">{{ fb.user?.name }}</span>
                <span class="tag tag-sm" :class="'fb-type-' + fb.type">{{ feedbackTypeLabel(fb.type) }}</span>
                <span class="fb-time">{{ fb.time }}</span>
              </div>
              <div class="fb-content">{{ fb.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-right">
      <div class="card info-card">
        <h3>任务信息</h3>
        <div class="info-list">
          <div class="info-row"><span class="info-label">任务类型</span><span>{{ taskTypeMap[task.task_type]?.label }}</span></div>
          <div class="info-row"><span class="info-label">发起人</span><span>{{ task.publisher?.name }}</span></div>
          <div v-if="task.task_type === 'key_work'" class="info-row"><span class="info-label">执行人</span><span>{{ task.direct_assignee?.name || task.assignees?.map(a => a.name).join(', ') || '待指派' }}</span></div>
          <div v-else class="info-row"><span class="info-label">主管</span><span>{{ task.supervisor?.name }}</span></div>
          <div v-if="task.task_type !== 'key_work' && task.task_type !== 'daily_management'" class="info-row"><span class="info-label">责任人</span><span>{{ task.assignees?.map(a => a.name).join(', ') || '待分配' }}</span></div>
          <div v-if="task.task_type === 'daily_management' && task.management_category" class="info-row"><span class="info-label">管理类别</span><span>{{ task.management_category }}{{ task.management_detail ? ': ' + task.management_detail : '' }}</span></div>
          <div class="info-row"><span class="info-label">截止日期</span><span :class="{ 'text-danger': isOverdue }">{{ task.deadline || '未设置' }}</span></div>
          <div class="info-row"><span class="info-label">创建时间</span><span>{{ task.created_at }}</span></div>
          <div v-if="task.completed_at" class="info-row"><span class="info-label">实际完成日期</span><span style="color:#52c41a;font-weight:600">{{ task.completed_at }}</span></div>
        </div>
      </div>

      <!-- Action Card -->
      <div class="card action-card">
        <h3>操作</h3>
        <div class="action-buttons">
          <!-- Leader: distribute task to supervisor -->
          <router-link v-if="task.status === 'pending' && canDistribute" :to="`/admin/task/${task.id}/decompose`" class="btn btn-primary btn-block">
            分解下发任务
          </router-link>

          <!-- Supervisor: assign subtasks -->
          <router-link v-if="task.status === 'pending' && canAssign" :to="`/admin/task/${task.id}/decompose`" class="btn btn-primary btn-block">
            分配子任务
          </router-link>

          <!-- Creator: start task (for pending tasks that don't need decompose) -->
          <button v-if="task.status === 'pending' && canStartTask" class="btn btn-primary btn-block" @click="handleStartTask">
            开始任务
          </button>

          <!-- Staff: submit output -->
          <router-link v-if="canSubmitOutputBtn && (task.status === 'in_progress' || task.status === 'feedback')" :to="`/admin/task/${task.id}/feedback`" class="btn btn-primary btn-block">
            提交输出物
          </router-link>

          <!-- Supervisor: review pending outputs -->
          <div v-if="canReview && hasPendingOutput" class="review-actions">
            <div v-for="out in pendingOutputs" :key="out.id" class="review-item">
              <div class="review-label">审核: {{ out.content?.substring(0, 30) }}...</div>
              <div class="review-btns">
                <button class="btn btn-sm btn-success" @click="openReviewModal(out)">审核</button>
              </div>
            </div>
          </div>

          <!-- Leader: final approval -->
          <div v-if="canApprove && task.status === 'review'" class="final-actions">
            <div class="form-group">
              <label class="form-label">审核意见</label>
              <textarea v-model="reviewComment" class="form-textarea" rows="2" placeholder="输入审核意见（可选）"></textarea>
            </div>
            <div class="action-row">
              <button class="btn btn-success" @click="handleFinalApproval(true)">通过</button>
              <button class="btn btn-danger" @click="handleFinalApproval(false)">退回重做</button>
            </div>
          </div>

          <!-- Daily management: direct complete (requires output + scoring/review first) -->
          <div v-if="task.task_type === 'daily_management' && task.status === 'in_progress' && task.outputs?.length > 0 && !(task.outputs?.filter(o => o.status === 'pending').length > 0)" class="daily-complete-actions">
            <button class="btn btn-primary btn-block" @click="handleDailyComplete">
              完成任务
            </button>
          </div>

          <!-- Completed badge -->
          <div v-if="task.status === 'completed'" class="completed-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            任务已完成

          <!-- Edit task -->
          <button v-if="canEdit && !isEditing && task.status !== 'completed' && task.status !== 'cancelled'" class="btn btn-block" @click="startEdit" style="margin-top: 8px">
            编辑任务
          </button>
          <div v-if="isEditing" class="edit-form">
            <div class="form-group">
              <label class="form-label">任务标题</label>
              <input v-model="editForm.title" class="form-textarea" style="min-height:auto" />
            </div>
            <div class="form-group">
              <label class="form-label">任务描述</label>
              <textarea v-model="editForm.description" class="form-textarea" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">优先级</label>
              <select v-model="editForm.priority" class="form-select">
                <option value="urgent">紧急</option>
                <option value="high">重要</option>
                <option value="normal">普通</option>
                <option value="low">低优</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">截止日期</label>
              <input v-model="editForm.deadline" type="date" class="form-textarea" style="min-height:auto" />
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-sm" @click="saveEdit">保存</button>
              <button class="btn btn-sm" @click="cancelEdit">取消</button>
            </div>
          </div>

          <!-- Recall task -->
          <button v-if="canRecall && !isEditing" class="btn btn-warning btn-block" @click="handleRecallTask" style="margin-top: 8px">
            撤回任务
          </button>

          <!-- Delete task -->
          <button v-if="canDelete && !isEditing" class="btn btn-danger btn-block" @click="handleDelete" style="margin-top: 8px">
            删除任务
          </button>
          </div>
        </div>
      </div>

      <!-- Supervision Card -->
      <div class="card" v-if="canSupervise">
        <h3>督办</h3>
        <div class="form-group">
          <select v-model="urgeType" class="form-select">
            <option value="urge">催办</option>
            <option value="warn">警告</option>
            <option value="escalate">升级</option>
          </select>
        </div>
        <div class="form-group">
          <textarea v-model="urgeContent" class="form-textarea" rows="2" placeholder="输入催办内容"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">延迟截止日期（可选）</label>
          <input v-model="urgeNewDeadline" type="date" class="form-textarea" style="min-height:auto" />
        </div>
        <button class="btn btn-sm btn-block" @click="handleUrge" :disabled="!urgeContent.trim()">发送催办</button>
      </div>
    </div>
  </div>

  <div v-else class="empty-state" style="padding:100px 0;text-align:center">
    <p>{{ loading ? '加载中...' : '任务不存在' }}</p>
  </div>

  <!-- Output Review Modal -->
  <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal = false">
    <div class="modal-content">
      <h3>{{ reviewOutput ? (reviewOutput.categoryL1Name ? `审核: ${reviewOutput.categoryL1Name} / ${reviewOutput.categoryL2Name} / ${reviewOutput.categoryL3Name}` : '审核输出物') : '审核输出物' }}</h3>
      <div v-if="reviewOutput" class="review-output-content" style="margin-bottom:16px; padding:12px; background:#fafbfc; border-radius:8px;">
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;">{{ reviewOutput.content }}</div>
        <div style="font-size:12px; color:var(--text-caption);">
          <span v-if="reviewOutput.categoryL1Name">分类: {{ reviewOutput.categoryL1Name }} / {{ reviewOutput.categoryL2Name }} / {{ reviewOutput.categoryL3Name }}</span>
          <span v-else>未分类</span>
        </div>
      </div>
      <div class="form-group" v-if="reviewOutput">
        <label class="form-label">分值规则</label>
        <div class="rule-display">
          <span class="tag" :class="ruleClass(reviewOutput.scoreRule)">{{ ruleLabel(reviewOutput.scoreRule) }}</span>
          <span v-if="reviewOutput.scoreRule === 'fixed'">参考分值 ≤ {{ reviewOutput.refScoreValue }}</span>
          <span v-if="reviewOutput.scoreRule === 'range'">参考分值 {{ reviewOutput.refScoreValue }} - {{ reviewOutput.refScoreUpper }}</span>
          <span v-if="reviewOutput.scoreRule === 'any'">任意分值</span>
        </div>
      </div>
      <div v-if="reviewOutput && reviewOutput.status === 'pending' && !rejecting" class="form-group">
        <label class="form-label">分数 <span class="req">*</span></label>
        <input v-model.number="reviewScore" type="number" step="0.5" min="0" class="form-textarea" style="min-height:auto" placeholder="请输入分数" />
        <div v-if="reviewOutput.scoreRule === 'fixed'" class="hint-line">该分类固定分值为 {{ reviewOutput.refScoreValue }}，分数不得超过此值</div>
        <div v-if="reviewOutput.scoreRule === 'range'" class="hint-line">该分类分值区间为 {{ reviewOutput.refScoreValue }} - {{ reviewOutput.refScoreUpper }}</div>
      </div>
      <div v-if="reviewOutput && reviewOutput.status === 'pending' && !rejecting" class="form-group">
        <label class="form-label">数量 <span class="req">*</span></label>
        <input v-model.number="reviewQty" type="number" step="0.5" min="0.5" class="form-textarea" style="min-height:auto" placeholder="请输入数量" />
        <div class="hint-line">总分 = 分数 × 数量</div>
      </div>
      <div class="form-group" v-if="rejecting">
        <label class="form-label">退回原因 <span class="req">*</span></label>
        <textarea v-model="reviewComment" class="form-textarea" rows="3" placeholder="请输入退回原因"></textarea>
      </div>
      <div v-if="reviewOutput && reviewOutput.status === 'pending' && !rejecting" class="score-preview">
        预估总分：<strong>{{ (reviewScore * reviewQty).toFixed(2) }}</strong>
      </div>
      <div class="modal-actions">
        <button v-if="rejecting" class="btn btn-primary" @click="confirmReject" :disabled="!reviewComment.trim()">确认退回</button>
        <button v-else class="btn btn-success" @click="confirmApprove" :disabled="reviewScore <= 0 || reviewQty <= 0">确认通过</button>
        <button v-if="rejecting" class="btn" @click="rejecting = false">取消退回</button>
        <button v-else class="btn btn-danger" @click="rejecting = true">退回</button>
        <button class="btn" @click="closeReviewModal">取消</button>
      </div>
    </div>
  </div>

  <!-- Subtask Urge Modal -->
  <div v-if="showUrgeModal" class="modal-overlay" @click.self="showUrgeModal = false">
    <div class="modal-content">
      <h3>催办子任务</h3>
      <div class="form-group">
        <label class="form-label">催办内容 <span class="text-danger">*</span></label>
        <textarea v-model="urgeContent" class="form-textarea" rows="3" placeholder="请输入催办内容"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">延迟截止日期（可选）</label>
        <input v-model="urgeNewDeadline" type="date" class="form-textarea" style="min-height:auto" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" @click="submitSubtaskUrge" :disabled="!urgeContent.trim()">发送</button>
        <button class="btn" @click="showUrgeModal = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { taskAPI } from '../../api/index.js'
import { authStore, taskTypeMap, statusMap, canReviewOutput, canSubmitOutput, canApproveFinal } from '../../store/auth.js'

const route = useRoute()
const task = ref(null)
const loading = ref(true)
const reviewComment = ref('')
const urgeType = ref('urge')
const urgeContent = ref('')
const urgeSubtaskId = ref(null)
const urgeNewDeadline = ref('')
const showUrgeModal = ref(false)

// Review modal state
const showReviewModal = ref(false)
const reviewOutput = ref(null)
const reviewScore = ref(0)
const reviewQty = ref(0)
const rejecting = ref(false)

const priorityMap = {
  urgent: { label: '紧急', color: '#ff4d4f', bg: '#fff2f0' },
  high: { label: '重要', color: '#fa8c16', bg: '#fff7e6' },
  normal: { label: '普通', color: '#1677ff', bg: '#e6f4ff' },
  low: { label: '低优', color: '#8c8c8c', bg: '#f5f5f5' }
}

const isOverdue = computed(() => {
  if (!task.value?.deadline) return false
  return new Date(task.value.deadline) < new Date() && task.value.status !== 'completed'
})

const canDistribute = computed(() => {
  const role = authStore.user?.role
  return role === 'leader' || role === 'admin'
})

const canAssign = computed(() => {
  const role = authStore.user?.role
  const uid = authStore.user?.id
  return (role === 'supervisor_tech' || role === 'supervisor_quality' || role === 'admin') 
    && task.value?.supervisor_id === uid
})

const canReview = computed(() => {
  const role = authStore.user?.role
  return canReviewOutput.value && task.value?.supervisor_id === authStore.user?.id
})

const canApprove = computed(() => canApproveFinal.value)

const canSubmitOutputBtn = computed(() => {
  if (!task.value) return false
  const role = authStore.user?.role
  // Staff can always submit outputs
  if (['staff_tech', 'staff_quality'].includes(role)) return true
  // Supervisors / leaders / admin can submit outputs for daily_management tasks (self-review after scoring)
  if (['supervisor_tech', 'supervisor_quality', 'leader'].includes(role) && task.value.task_type === 'daily_management') return true
  if (role === 'admin' && task.value.task_type === 'daily_management') return true
  return false
})

const canSupervise = computed(() => {
  const role = authStore.user?.role
  return role === 'leader' || role === 'admin'
})


const canDelete = computed(() => ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'].includes(authStore.user?.role))

const canRecall = computed(() => {
  if (!task.value) return false
  if (task.value.status !== 'pending' && task.value.status !== 'decomposing') return false
  const uid = authStore.user?.id
  return task.value.publisher_id === uid || 
    task.value.supervisor_id === uid ||
    ['admin', 'leader'].includes(authStore.user?.role)
})

const canStartTask = computed(() => {
  if (!task.value) return false
  if (task.value.status !== 'pending') return false
  const uid = authStore.user?.id
  // Task creator can start the task if they're not a leader/supervisor who would use decompose/assign
  const role = authStore.user?.role
  const isPublisher = task.value.publisher_id === uid
  const isLeaderOrSupervisor = ['leader', 'supervisor_tech', 'supervisor_quality', 'admin'].includes(role)
  return isPublisher && !isLeaderOrSupervisor
})

// Recall functions
async function handleRecallOutput(outputId) {
  if (!confirm('确定要撤回此输出物吗？')) return
  try {
    const data = await taskAPI.recallOutput(task.value.id, outputId)
    task.value = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleRecallComplete() {
  if (!confirm('确定要撤回完成验收申请吗？')) return
  try {
    const data = await taskAPI.recallComplete(task.value.id)
    task.value = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleRecallTask() {
  if (!confirm('确定要撤回此任务吗？此操作不可恢复。')) return
  try {
    const data = await taskAPI.recall(task.value.id)
    task.value = data.task
  } catch (e) {
    alert(e.message)
  }
}

const canRecallComplete = computed(() => {
  if (task.value?.status !== 'review') return false
  const uid = authStore.user?.id
  return task.value?.publisher_id === uid || 
    task.value?.assignees?.some(a => a.id === uid) ||
    task.value?.supervisor_id === uid
})

const isEditing = ref(false)
const editForm = ref({})

function startEdit() {
  editForm.value = {
    title: task.value.title,
    description: task.value.description,
    priority: task.value.priority,
    deadline: task.value.deadline || '',
    supervisor_id: task.value.supervisor_id || null
  }
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editForm.value = {}
}

async function saveEdit() {
  try {
    const data = await taskAPI.update(task.value.id, editForm.value)
    task.value = data.task
    isEditing.value = false
  } catch (e) {
    alert(e.message)
  }
}

const isKeyWorkAssignee = computed(() => {
  if (task.value?.task_type !== 'key_work') return false
  const uid = authStore.user?.id
  return task.value?.assignees?.some(a => a.id === uid) || task.value?.direct_assignee?.id === uid
})

const pendingOutputs = computed(() => {
  return task.value?.outputs?.filter(o => o.status === 'pending') || []
})

const hasPendingOutput = computed(() => pendingOutputs.value.length > 0)

const canRecallOutput = (output) => {
  if (!output || !task.value) return false
  const uid = authStore.user?.id
  // Only the submitter can recall their own pending output
  return output.submitter?.id === uid && output.status === 'pending'
}

function feedbackTypeLabel(type) {
  return { progress: '进度更新', issue: '问题反馈', complete: '完成报告', output: '输出物', review: '审核', approved: '通过', rejected: '退回', comment: '评论' }[type] || type
}

function ruleLabel(rule) {
  return { fixed: '单值', range: '区间', any: '任意' }[rule] || ''
}
function ruleClass(rule) {
  return `rule-${rule || 'fixed'}`
}

async function loadTask() {
  loading.value = true
  try {
    const data = await taskAPI.get(Number(route.params.id))
    task.value = data.task
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openReviewModal(output) {
  reviewOutput.value = output
  rejecting.value = false
  reviewComment.value = ''
  // Pre-fill score from the reference score hint (not the actual scoreValue which may be 0)
  if (output.scoreRule === 'fixed' && output.refScoreValue) {
    reviewScore.value = output.refScoreValue
  } else if (output.scoreRule === 'range' && output.refScoreValue) {
    reviewScore.value = output.refScoreValue
  } else {
    reviewScore.value = output.scoreValue || 0
  }
  reviewQty.value = output.scoreQuantity || 1
  showReviewModal.value = true
}

function closeReviewModal() {
  showReviewModal.value = false
  reviewOutput.value = null
  reviewScore.value = 0
  reviewQty.value = 0
  rejecting.value = false
}

async function confirmApprove() {
  if (!reviewOutput.value) return
  if (reviewScore.value <= 0 || reviewQty.value <= 0) return
  try {
    const data = await taskAPI.reviewOutput(task.value.id, {
      output_id: reviewOutput.value.id,
      approved: true,
      comment: '',
      score_value: reviewScore.value,
      score_quantity: reviewQty.value
    })
    task.value = data.task
    closeReviewModal()
  } catch (e) {
    alert(e.message)
  }
}

async function confirmReject() {
  if (!reviewOutput.value) return
  if (!reviewComment.value.trim()) return
  try {
    const data = await taskAPI.reviewOutput(task.value.id, {
      output_id: reviewOutput.value.id,
      approved: false,
      comment: reviewComment.value,
      score_value: 0,
      score_quantity: 0
    })
    task.value = data.task
    closeReviewModal()
  } catch (e) {
    alert(e.message)
  }
}

async function handleFinalApproval(approved) {
  try {
    const data = await taskAPI.approveFinal(task.value.id, { approved, comment: reviewComment.value })
    task.value = data.task
    reviewComment.value = ''
  } catch (e) {
    alert(e.message)
  }
}

async function handleUrge() {
  if (!urgeContent.value.trim()) return
  try {
    await taskAPI.urge(task.value.id, {
      type: urgeType.value,
      content: urgeContent.value.trim(),
      subtask_id: urgeSubtaskId.value,
      new_deadline: urgeNewDeadline.value || undefined
    })
    urgeContent.value = ''
    urgeSubtaskId.value = null
    urgeNewDeadline.value = ''
    await loadTask()
    alert('催办已发送')
  } catch (e) {
    alert(e.message)
  }
}

async function handleSubtaskUrge(subtaskId) {
  urgeSubtaskId.value = subtaskId
  urgeNewDeadline.value = ''
  urgeContent.value = ''
  urgeType.value = 'urge'
  showUrgeModal.value = true
}

async function handleDelete() {
  if (!confirm('确定要删除此任务吗？此操作不可恢复。')) return
  try {
    await taskAPI.remove(task.value.id)
    window.location.href = '/admin/tasks'
  } catch (e) {
    alert(e.message)
  }
}
async function submitSubtaskUrge() {
  if (!urgeContent.value.trim()) return
  try {
    await taskAPI.urge(task.value.id, {
      type: 'urge',
      content: urgeContent.value.trim(),
      subtask_id: urgeSubtaskId.value,
      new_deadline: urgeNewDeadline.value || undefined
    })
    showUrgeModal.value = false
    urgeContent.value = ''
    urgeSubtaskId.value = null
    urgeNewDeadline.value = ''
    await loadTask()
    alert('催办已发送')
  } catch (e) {
    alert(e.message)
  }
}

async function handleDailyComplete() {
  // Daily management tasks must have submitted output and must be reviewed/scored.
  // Cannot complete directly without output submission and scoring/review.
  if (!task.value?.outputs?.length) {
    alert('部门日常管理任务必须先提交输出物并完成评分审核后才能完成，不能直接标记完成。')
    return
  }
  const pending = task.value.outputs?.filter(o => o.status === 'pending') || []
  if (pending.length > 0) {
    alert('仍有未审核的输出物，请先完成审核评分后再标记完成。')
    return
  }
  // Also require at least one output to have a score set (scored/reviewed)
  const hasScored = task.value.outputs?.some(o => o.scoreValue !== undefined && o.scoreValue !== null)
  if (!hasScored) {
    alert('部门日常管理任务需要输出物评分后才能完成。请先提交输出物并完成评分审核。')
    return
  }
  if (!confirm('已提交输出物并完成评分，确认标记此任务为完成？')) return
  try {
    const data = await taskAPI.approveFinal(task.value.id, { approved: true, comment: '日常管理任务完成（已评分审核）' })
    task.value = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleStartTask() {
  if (!confirm('确定要开始此任务吗？')) return
  try {
    const data = await taskAPI.update(task.value.id, { status: 'in_progress' })
    task.value = data.task
    alert('任务已开始')
  } catch (e) {
    alert(e.message)
  }
}

onMounted(loadTask)
</script>

<style scoped>
.task-detail { display: flex; gap: 24px; max-width: 1400px; }
.detail-left { flex: 1; min-width: 0; }
.detail-right { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }

.back-btn {
  display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
  cursor: pointer; color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; padding: 0;
}
.back-btn:hover { color: var(--primary); }
.task-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 12px 0; }
.tags-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-sm { font-size: 11px; padding: 1px 6px; }

.progress-section { margin-bottom: 20px; }
.progress-header { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: var(--text-secondary); }

.desc-section { margin-bottom: 24px; }
.desc-section h3, .section h3 { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 12px 0; }
.desc-section p { font-size: 14px; color: var(--text-secondary); line-height: 1.7; }

.section { margin-bottom: 24px; }

.subtask-list { display: flex; flex-direction: column; gap: 8px; }
.subtask-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafbfc; border-radius: 8px; }
.subtask-info { display: flex; flex-direction: column; gap: 2px; }
.subtask-title { font-size: 13px; color: var(--text); font-weight: 500; }
.subtask-assignee { font-size: 12px; color: var(--text-secondary); }
.subtask-right { display: flex; align-items: center; gap: 8px; }

.output-list { display: flex; flex-direction: column; gap: 10px; }
.output-item { padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border); }
.output-item.output-approved { border-color: #b7eb8f; background: #f6ffed; }
.output-item.output-rejected { border-color: #ffa39e; background: #fff2f0; }
.output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.output-user { font-size: 13px; font-weight: 500; color: var(--text); }
.output-time { font-size: 12px; color: var(--text-caption); margin-left: auto; }
.output-content { font-size: 14px; color: var(--text); line-height: 1.5; }
.output-review { font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.output-status-pending { color: #fa8c16; background: #fff7e6; }
.output-status-approved { color: #52c41a; background: #f6ffed; }
.output-status-rejected { color: #ff4d4f; background: #fff2f0; }

.feedback-list { display: flex; flex-direction: column; gap: 12px; }
.feedback-item { display: flex; gap: 10px; }
.fb-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.fb-body { flex: 1; }
.fb-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.fb-name { font-size: 13px; font-weight: 500; color: var(--text); }
.fb-time { font-size: 12px; color: var(--text-caption); margin-left: auto; }
.fb-content { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.fb-type-progress { color: var(--primary); background: var(--primary-light); }
.fb-type-output { color: #13c2c2; background: #e6fffb; }
.fb-type-review { color: #fa8c16; background: #fff7e6; }
.fb-type-approved { color: #52c41a; background: #f6ffed; }
.fb-type-rejected { color: #ff4d4f; background: #fff2f0; }
.fb-type-complete { color: var(--success); background: #f6ffed; }
.fb-type-comment { color: var(--text-secondary); background: #f5f5f5; }
.empty-hint { font-size: 13px; color: var(--text-caption); padding: 12px 0; }

.output-category {
  font-size: 12px; color: var(--primary); background: var(--primary-light);
  padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;
}
.output-score {
  display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;
  font-size: 12px; color: var(--text-secondary);
}
.output-score-ref {
  display: flex; align-items: center; gap: 6px; margin-top: 6px;
  font-size: 12px; color: var(--text-secondary);
}
.score-ref-text { color: var(--text); font-weight: 500; }
.score-label { font-weight: 500; }
.score-text { color: var(--primary); font-weight: 600; }
.output-rule { color: var(--text-caption); }

.card { background: #fff; border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.card h3 { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 14px 0; }
.info-list { display: flex; flex-direction: column; gap: 10px; }
.info-row { display: flex; justify-content: space-between; font-size: 13px; }
.info-label { color: var(--text-secondary); }
.info-row span:last-child { color: var(--text); font-weight: 500; }
.text-danger { color: var(--danger) !important; }
.btn-urge {
  padding: 2px 6px; font-size: 14px; border: 1px solid #faad14; background: #fffbe6;
  border-radius: 4px; cursor: pointer; transition: all 0.2s; min-width: auto;
}
.btn-urge:hover { background: #faad14; color: #fff; }

.action-buttons { display: flex; flex-direction: column; gap: 8px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
  transition: all 0.2s; text-decoration: none;
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover { background: #4096ff; }
.btn-block { width: 100%; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-success { background: #52c41a; color: #fff; border-color: #52c41a; }
.btn-danger { background: #ff4d4f; color: #fff; border-color: #ff4d4f; }
.btn-warning { background: #faad14; color: #fff; border-color: #faad14; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.review-actions { display: flex; flex-direction: column; gap: 8px; }
.review-item { padding: 10px; background: #fffbe6; border-radius: 8px; border: 1px solid #ffe58f; }
.review-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.review-btns { display: flex; gap: 6px; }

.final-actions { display: flex; flex-direction: column; gap: 10px; }
.form-group { margin-bottom: 0; }
.form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.form-textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 13px; resize: vertical; outline: none; font-family: inherit; box-sizing: border-box; }
.form-textarea:focus { border-color: var(--primary); }
.action-row { display: flex; gap: 8px; }

.completed-badge { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: #f6ffed; color: #52c41a; border-radius: 8px; font-size: 14px; font-weight: 500; }

.form-select {
  width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 28px 0 10px; font-size: 13px; color: var(--text);
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer; outline: none; box-sizing: border-box;
}

.empty-state { color: var(--text-secondary); font-size: 14px; }

@media (max-width: 900px) {
  .task-detail { flex-direction: column; }
  .detail-right { width: 100%; }
}

.edit-form { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; padding: 12px; background: #fafbfc; border-radius: 8px; }
.edit-form .form-group { margin-bottom: 0; }
.subtask-deadline { font-size: 11px; color: var(--text-caption); white-space: nowrap; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; padding: 24px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.modal-content h3 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: var(--text); }
.modal-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; flex-wrap: wrap; }
.rule-display { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.tag.rule-fixed { color: #fa8c16; background: #fff7e6; }
.tag.rule-range { color: #1677ff; background: #e6f4ff; }
.tag.rule-any { color: #8c8c8c; background: #f5f5f5; }
.req { color: #ff4d4f; }
.hint-line { font-size: 11px; color: var(--text-caption); margin-top: 4px; }
.score-preview { padding: 10px 12px; background: #f6ffed; border-radius: 6px; color: #52c41a; font-size: 14px; margin: 8px 0; }
</style>
