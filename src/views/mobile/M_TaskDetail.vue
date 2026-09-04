<template>
  <div class="page" v-if="task">
    <!-- Header -->
    <div class="page-header" style="padding-bottom: 16px">
      <div class="m-back-row" @click="$router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style="font-size: 13px">返回</span>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 6px">
        <span class="tag" :style="{ background: priority.bg, color: priority.color }">{{ priority.label }}</span>
        <span class="tag" :style="{ background: status.bg, color: status.color }">{{ status.label }}</span>
      </div>
      <h1 style="font-size: 17px; line-height: 1.4">{{ task.title }}</h1>
    </div>

    <!-- Progress -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px">
        <span style="font-size: 13px; font-weight: 500">任务进度</span>
        <span style="font-size: 13px; font-weight: 600; color: var(--primary)">{{ task.progress }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: progressColor }"></div>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="card">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <div class="m-info-label">发布人</div>
          <div style="display: flex; align-items: center; gap: 6px">
            <div class="avatar" :style="avatarStyle('#1677ff')">{{ task.publisher.name[0] }}</div>
            <span style="font-size: 13px">{{ task.publisher.name }}</span>
          </div>
        </div>
        <div>
          <div class="m-info-label">责任部门</div>
          <span style="font-size: 13px">{{ task.department }}</span>
        </div>
        <div>
          <div class="m-info-label">截止日期</div>
          <span style="font-size: 13px" :style="{ color: isOverdue ? 'var(--danger)' : 'var(--text)' }">{{ task.deadline }}</span>
        </div>
        <div>
          <div class="m-info-label">主管/执行人</div>
          <span style="font-size: 13px">{{ task.task_type === "key_work" ? (task.direct_assignee?.name || task.assignees?.[0]?.name || "待指派") : (task.supervisor?.name || "-") }}</span>
        </div>
        <div>
          <div class="m-info-label">当前状态</div>
          <span class="tag" :style="{ background: status.bg, color: status.color }">{{ status.label }}</span>
        </div>
        <div v-if="task.task_type === 'daily_management' && task.management_category">
          <div class="m-info-label">管理类别</div>
          <span style="font-size: 13px">{{ task.management_category }}{{ task.management_detail ? ': ' + task.management_detail : '' }}</span>
        </div>
        <div>
          <div class="m-info-label">创建日期</div>
          <span style="font-size: 13px">{{ task.createdAt }}</span>
        </div>
      </div>
    </div>

    <!-- Assignees -->
    <div class="card" v-if="task.task_type !== 'daily_management'">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">责任人</div>
      <div style="display: flex; flex-wrap: wrap; gap: 10px">
        <div v-for="u in task.assignees" :key="u.id" style="display: flex; align-items: center; gap: 6px">
          <div class="avatar" :style="avatarStyle('#52c41a')">{{ u.name[0] }}</div>
          <div>
            <div style="font-size: 13px">{{ u.name }}</div>
            <div style="font-size: 11px; color: var(--text-caption)">{{ u.dept }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px">任务描述</div>
      <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.7">{{ task.description }}</p>
    </div>

    <!-- Tags -->
    <div class="card" v-if="task.tags.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px">标签</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px">
        <span v-for="tag in task.tags" :key="tag" class="tag" style="background: #e6f4ff; color: #1677ff">{{ tag }}</span>
      </div>
    </div>

    <!-- Milestones -->
    <div class="card" v-if="task.milestones.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">里程碑</div>
      <div v-for="(m, i) in task.milestones" :key="i" class="m-milestone-row">
        <div class="m-milestone-dot-col">
          <div class="m-milestone-dot" :class="{ done: m.done }">
            <svg v-if="m.done" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div v-if="i < task.milestones.length - 1" class="m-milestone-line"></div>
        </div>
        <div class="m-milestone-info">
          <div :style="{ fontSize: '13px', fontWeight: m.done ? '400' : '500', color: m.done ? 'var(--text-caption)' : 'var(--text)', textDecoration: m.done ? 'line-through' : 'none' }">{{ m.title }}</div>
          <div style="font-size: 11px; color: var(--text-caption); margin-top: 2px">{{ m.date }}</div>
        </div>
      </div>
    </div>

    <!-- Subtasks -->
    <div class="card" v-if="task.subtasks.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">子任务 ({{ task.subtasks.length }})</div>
      <div v-for="sub in task.subtasks" :key="sub.id" class="m-subtask-item">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px">
          <div style="display: flex; align-items: center; gap: 8px">
            <div class="avatar" :style="avatarStyle('#722ed1')">{{ sub.assignee.name[0] }}</div>
            <div>
              <div style="font-size: 13px; font-weight: 500">{{ sub.title }}</div>
              <div style="font-size: 11px; color: var(--text-caption)">{{ sub.assignee.name }}</div>
            </div>
          </div>
          <span class="tag" :style="{ background: getStatusKey(sub).bg, color: getStatusKey(sub).color }">{{ getStatusKey(sub).label }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" :style="{ width: sub.progress + '%', background: subProgressColor(sub.progress) }"></div>
        </div>
      </div>
    </div>

    <!-- Outputs -->
    <div class="card" v-if="task.outputs?.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">输出物 ({{ task.outputs.length }})</div>
      <div v-for="out in task.outputs" :key="out.id" class="m-output-item" :class="'output-' + out.status">
        <div class="m-output-header">
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
        <div v-if="out.categoryL1Name" class="output-category-text">{{ out.categoryL1Name }} / {{ out.categoryL2Name }} / {{ out.categoryL3Name }}</div>
        <div v-if="out.scoreRule" class="output-score-ref">
          <span class="tag tag-sm" :class="'rule-' + out.scoreRule">{{ ruleLabel(out.scoreRule) }}</span>
          <span v-if="out.scoreRule === 'fixed'">≤ {{ out.refScoreValue }}</span>
          <span v-if="out.scoreRule === 'range'">{{ out.refScoreValue }} - {{ out.refScoreUpper }}</span>
          <span v-if="out.scoreRule === 'any'">任意</span>
        </div>
        <div v-if="out.scoreTotal > 0" class="output-score-display">
          分值：{{ out.scoreValue }} × {{ out.scoreQuantity }} = {{ out.scoreTotal }}
        </div>
        <div v-if="out.reviewComment" class="output-review">
          审核意见: {{ out.reviewComment }}
          <span v-if="out.reviewer"> — {{ out.reviewer.name }}</span>
        </div>
      </div>
    </div>

    <!-- Feedbacks -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">动态 ({{ task.feedbacks.length }})</div>
      <div v-for="fb in task.feedbacks" :key="fb.id" class="m-feedback-item">
        <div class="avatar" :style="avatarStyle('#1677ff')">{{ fb.user.name[0] }}</div>
        <div style="flex: 1">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
            <span style="font-size: 13px; font-weight: 500">{{ fb.user.name }}</span>
            <span style="font-size: 11px; color: var(--text-caption)">{{ fb.time }}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5">{{ fb.content }}</p>
        </div>
      </div>
      <div v-if="!task.feedbacks.length" style="text-align: center; padding: 16px; color: var(--text-caption); font-size: 13px">暂无动态</div>
    </div>

    <!-- Bottom Actions -->
    <div class="m-action-bar">
      <button v-if="task.status === 'pending' && task.task_type !== 'key_work' && task.task_type !== 'daily_management' && canDistribute" class="btn btn-primary" @click="goDecompose">任务分解</button>
      <button v-if="task.status === 'decomposing'" class="btn btn-primary" @click="goDecompose">添加子任务</button>
      <button v-if="(task.status === 'pending' || task.status === 'decomposing') && canRecall" class="btn btn-warning" @click="handleRecallTask">撤回任务</button>
      <template v-if="task.status === 'in_progress'">
        <button class="btn btn-outline" style="flex: 1" @click="showUrgePanel = true">催办</button>
        <button class="btn btn-primary" style="flex: 1" @click="goFeedback">提交反馈</button>
      </template>
      <button v-if="task.status === 'in_progress' && task.task_type === 'daily_management'" class="btn btn-primary" @click="goFeedback">反馈输出物</button>
      <button v-if="canDailyComplete" class="btn btn-success" @click="handleDailyComplete">完成任务</button>
      <button v-if="task.status === 'feedback'" class="btn btn-primary" @click="handleApplyComplete">申请完成</button>
      <button v-if="task.status === 'review'" class="btn btn-outline" style="flex: 1" @click="handleRecallComplete">撤回申请</button>
      <template v-if="task.status === 'review'">
        <button class="btn btn-outline" style="flex: 1" @click="handleReject">驳回</button>
        <button class="btn btn-primary" style="flex: 1" @click="handleApprove">批准完成</button>
      </template>
      <div v-if="task.status === 'completed'" class="m-completed-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>已完成</span>
      </div>
      <button v-if="task.status === 'overdue'" class="btn btn-danger" @click="showUrgePanel = true">催办</button>
    </div>

    <!-- Urge Panel -->
    <Teleport to="body">
      <div v-if="showUrgePanel" class="slide-panel">
        <div class="slide-overlay" @click="showUrgePanel = false"></div>
        <div class="slide-content" style="padding: 24px">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px">催办通知</h3>
          <div class="form-group">
            <label class="form-label">催办类型</label>
            <div style="display: flex; gap: 8px">
              <span class="filter-tab" :class="{ active: urgeType === 'urge' }" @click="urgeType = 'urge'">催办</span>
              <span class="filter-tab" :class="{ active: urgeType === 'warn' }" @click="urgeType = 'warn'">警告</span>
              <span class="filter-tab" :class="{ active: urgeType === 'escalate' }" @click="urgeType = 'escalate'">升级</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">催办内容</label>
            <textarea class="form-textarea" v-model="urgeMsg" placeholder="请输入催办内容"></textarea>
          </div>
          <button class="btn btn-primary" @click="handleUrge">发送</button>
        </div>
      </div>
    </Teleport>

  </div>

  <!-- Not Found -->
  <div v-else class="empty-state" style="padding-top: 100px">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <p>任务不存在</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, priorityMap, statusMap, updateTaskStatus, submitCompleteRequest, approveTask, sendUrge, addFeedback } from '../../store/tasks.js'
import { authStore, statusMap as authStatusMap } from '../../store/auth.js'
import { taskAPI } from '../../api/index.js'

const route = useRoute()
const router = useRouter()

const task = computed(() => store.tasks.find(t => t.id === Number(route.params.id)))
const canDistribute = computed(() => {
  const role = authStore.user?.role
  return role === 'admin' || role === 'supervisor_tech' || role === 'supervisor_quality' || 
    (role && task.value?.supervisor_id === authStore.user?.id)
})
const priority = computed(() => priorityMap[task.value?.priority] || {})
const status = computed(() => statusMap[task.value?.status] || {})
const isOverdue = computed(() => task.value && new Date(task.value.deadline) < new Date())
const progressColor = computed(() => {
  const p = task.value?.progress || 0
  if (p >= 80) return '#52c41a'
  if (p >= 50) return '#1677ff'
  if (p >= 20) return '#fa8c16'
  return '#ff4d4f'
})

function getStatusKey(item) { return statusMap[item.status] || {} }

function ruleLabel(rule) {
  return { fixed: '单值', range: '区间', any: '任意' }[rule] || ''
}

const canRecall = computed(() => {
  if (!task.value) return false
  if (task.value.status !== 'pending' && task.value.status !== 'decomposing') return false
  const uid = authStore.user?.id
  return task.value.publisher_id === uid || 
    task.value.supervisor_id === uid ||
    ['admin', 'leader'].includes(authStore.user?.role)
})

const canDailyComplete = computed(() => {
  if (!task.value) return false
  if (task.value.task_type !== 'daily_management') return false
  if (task.value.status !== 'in_progress') return false
  if (!task.value.outputs?.length) return false
  const hasPending = task.value.outputs.some(o => o.status === 'pending')
  if (hasPending) return false
  const hasScored = task.value.outputs.some(o => o.scoreValue > 0)
  return hasScored
})

const canRecallOutput = (output) => {
  if (!output || !task.value) return false
  const uid = authStore.user?.id
  return output.submitter?.id === uid && output.status === 'pending'
}

function subProgressColor(p) {
  if (p >= 80) return '#52c41a'
  if (p >= 50) return '#1677ff'
  if (p >= 20) return '#fa8c16'
  return '#ff4d4f'
}

function avatarStyle(bg) {
  return { background: bg, width: '28px', height: '28px', fontSize: '11px' }
}

const showUrgePanel = ref(false)
const urgeMsg = ref('')
const urgeType = ref('urge')

function goDecompose() {
  router.push(`/m/task/${task.value.id}/decompose`)
}

function goFeedback() {
  router.push(`/m/task/${task.value.id}/feedback`)
}

function handleApplyComplete() {
  submitCompleteRequest(task.value.id)
  router.push(`/m/task/${task.value.id}/complete`)
}

function handleApprove() {
  approveTask(task.value.id)
}

function handleReject() {
  updateTaskStatus(task.value.id, 'in_progress')
}

function handleUrge() {
  if (!urgeMsg.value.trim()) return
  sendUrge(task.value.id, urgeMsg.value, urgeType.value)
  showUrgePanel.value = false
  urgeMsg.value = ''
  urgeType.value = 'urge'
}

async function handleRecallComplete() {
  if (!task.value) return
  if (!confirm('确定要撤回完成验收申请吗？')) return
  try {
    const data = await taskAPI.recallComplete(task.value.id)
    // Update the task in store
    const idx = store.tasks.findIndex(t => t.id === task.value.id)
    if (idx >= 0) store.tasks[idx] = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleRecallTask() {
  if (!task.value) return
  if (!confirm('确定要撤回此任务吗？此操作不可恢复。')) return
  try {
    const data = await taskAPI.recall(task.value.id)
    // Update the task in store
    const idx = store.tasks.findIndex(t => t.id === task.value.id)
    if (idx >= 0) store.tasks[idx] = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleRecallOutput(outputId) {
  if (!confirm('确定要撤回此输出物吗？')) return
  try {
    const data = await taskAPI.recallOutput(task.value.id, outputId)
    // Update the task in store
    const idx = store.tasks.findIndex(t => t.id === task.value.id)
    if (idx >= 0) store.tasks[idx] = data.task
  } catch (e) {
    alert(e.message)
  }
}

async function handleDailyComplete() {
  if (!task.value) return
  if (!confirm('已提交输出物并完成评分，确认标记此任务为完成？')) return
  try {
    const data = await taskAPI.approveFinal(task.value.id, { approved: true, comment: '日常管理任务完成（已评分审核）' })
    const idx = store.tasks.findIndex(t => t.id === task.value.id)
    if (idx >= 0) store.tasks[idx] = data.task
  } catch (e) {
    alert(e.message)
  }
}
</script>

<style scoped>
.m-back-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}
.m-info-label {
  font-size: 11px;
  color: var(--text-caption);
  margin-bottom: 4px;
}
.m-milestone-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  position: relative;
}
.m-milestone-dot-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.m-milestone-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e5e6eb;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-milestone-dot.done {
  background: #52c41a;
}
.m-milestone-line {
  width: 2px;
  flex: 1;
  background: #e5e6eb;
  margin-top: 2px;
}
.m-milestone-info {
  flex: 1;
  padding-bottom: 4px;
}
.m-subtask-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.m-subtask-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.m-feedback-item {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.m-feedback-item:last-child {
  margin-bottom: 0;
}
.m-action-bar {
  position: sticky;
  bottom: 60px;
  padding: 12px 16px;
  padding-bottom: calc(12px + 60px);
  display: flex;
  gap: 10px;
  background: var(--bg);
}
.m-completed-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 40px;
  background: #f6ffed;
  color: #52c41a;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
}

.m-output-item {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 10px;
  background: #fff;
}
.m-output-item.output-approved { border-color: #b7eb8f; background: #f6ffed; }
.m-output-item.output-rejected { border-color: #ffa39e; background: #fff2f0; }

.m-output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.output-user { font-size: 13px; font-weight: 500; color: var(--text); }
.output-time { font-size: 12px; color: var(--text-caption); margin-left: auto; }
.output-content { font-size: 14px; color: var(--text); line-height: 1.5; }
.output-review { font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.output-status-pending { color: #fa8c16; background: #fff7e6; }
.output-status-approved { color: #52c41a; background: #f6ffed; }
.output-status-rejected { color: #ff4d4f; background: #fff2f0; }
.output-category-text { font-size: 12px; color: var(--primary); margin-bottom: 4px; }
.output-score-ref { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
.output-score-display { font-size: 12px; color: var(--primary); font-weight: 600; margin-top: 4px; }
.rule-fixed { color: #fa8c16; background: #fff7e6; }
.rule-range { color: #1677ff; background: #e6f4ff; }
.rule-any { color: #8c8c8c; background: #f5f5f5; }

.btn-warning { background: #faad14; color: #fff; border-color: #faad14; }
.btn-success { background: #52c41a; color: #fff; border-color: #52c41a; }
</style>
