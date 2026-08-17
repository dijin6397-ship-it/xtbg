<template>
  <div class="page-wrap" v-if="task">
    <button class="back-btn" @click="$router.push(`/admin/task/${task.id}`)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      返回任务详情
    </button>

    <h2 class="page-title">提交输出物</h2>
    <p class="page-desc">{{ task.title }}</p>

    <!-- Current Progress -->
    <div class="card">
      <div class="progress-header">
        <span>当前进度</span><span class="progress-value">{{ task.progress }}%</span>
      </div>
      <div class="progress-bar" style="width:100%;height:8px">
        <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: progressColor }"></div>
      </div>
      <div class="progress-hint" v-if="task.subtasks?.length">
        已完成 {{ completedCount }}/{{ task.subtasks.length }} 个子任务
      </div>
    </div>

    <!-- Output Submission -->
    <div class="card">
      <h3 class="card-title">提交输出物</h3>
      <p class="card-hint">输出物可以是文件名、文件路径或一段文字描述，提交后将进入审核流程。</p>

      <div class="form-group" v-if="myIncompleteSubtasks.length > 1">
        <label class="form-label">选择子任务 <span class="required">*</span></label>
        <select class="form-select-subtask" v-model="selectedSubtaskId">
          <option :value="null" disabled>请选择要提交的子任务</option>
          <option v-for="sub in myIncompleteSubtasks" :key="sub.id" :value="sub.id">
            {{ sub.title }} ({{ sub.assignee?.name || '未分配' }})
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">输出物内容 <span class="required">*</span></label>
        <textarea 
          class="form-textarea" 
          v-model="outputContent" 
          placeholder="请输入输出物内容，如文件名、路径或文字描述..." 
          rows="5"
        ></textarea>
      </div>

      <button class="btn btn-primary" @click="handleSubmitOutput" :disabled="!outputContent.trim() || submitting">
        {{ submitting ? '提交中...' : '提交输出物' }}
      </button>
    </div>

    <!-- Existing Outputs -->
    <div class="card" v-if="task.outputs?.length">
      <h3 class="card-title">已提交的输出物 ({{ task.outputs.length }})</h3>
      <div class="output-list">
        <div v-for="out in task.outputs" :key="out.id" class="output-item" :class="'output-' + out.status">
          <div class="output-header">
            <span class="output-user">{{ out.submitter?.name }}</span>
            <span class="tag tag-sm" :class="'output-status-' + out.status">
              {{ { pending: '待审核', approved: '已通过', rejected: '已退回' }[out.status] }}
            </span>
            <span class="output-time">{{ out.createdAt }}</span>
          </div>
          <div class="output-content">{{ out.content }}</div>
          <div v-if="out.reviewComment" class="output-review">
            审核意见: {{ out.reviewComment }}
          </div>
        </div>
      </div>
    </div>

    <!-- Subtasks Status -->
    <div class="card" v-if="task.subtasks?.length">
      <h3 class="card-title">子任务进度</h3>
      <div class="subtask-list">
        <div v-for="sub in task.subtasks" :key="sub.id" class="subtask-item">
          <div class="subtask-info">
            <span class="subtask-title">{{ sub.title }}</span>
            <span class="subtask-assignee">{{ sub.assignee?.name || '未分配' }}</span>
          </div>
          <span class="tag tag-sm" :class="sub.status === 'completed' ? 'tag-success' : 'tag-default'">
            {{ sub.status === 'completed' ? '已完成' : '进行中' }}
          </span>
        </div>
      </div>
    </div>

    <!-- History Feedbacks -->
    <div class="card" v-if="task.feedbacks?.length">
      <h3 class="card-title">历史反馈 ({{ task.feedbacks.length }})</h3>
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

  <div v-else class="empty-state" style="padding:100px 0;text-align:center">
    {{ loading ? '加载中...' : '任务不存在' }}
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { taskAPI } from '../../api/index.js'

const route = useRoute()
const router = useRouter()
const task = ref(null)
const loading = ref(true)
const submitting = ref(false)
const outputContent = ref('')
const selectedSubtaskId = ref(null)

const progressColor = computed(() => {
  const p = task.value?.progress || 0
  if (p === 100) return 'var(--success)'
  if (p >= 60) return 'var(--primary)'
  return '#fa8c16'
})

const myIncompleteSubtasks = computed(() => {
  const userId = JSON.parse(localStorage.getItem('user') || '{}')?.id
  return task.value?.subtasks?.filter(s => s.status !== 'completed' && (!userId || s.assignee?.id === userId)) || []
})

const completedCount = computed(() => {
  return task.value?.subtasks?.filter(s => s.status === 'completed').length || 0
})

function feedbackTypeLabel(type) {
  return { progress: '进度更新', issue: '问题反馈', complete: '完成报告', output: '输出物', review: '审核', approved: '通过', rejected: '退回', comment: '评论' }[type] || type
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

async function handleSubmitOutput() {
  if (!outputContent.value.trim()) return
  // If multiple subtasks, require selection
  if (myIncompleteSubtasks.value.length > 1 && !selectedSubtaskId.value) {
    alert('请选择要提交的子任务')
    return
  }
  submitting.value = true
  try {
    await taskAPI.submitOutput(task.value.id, {
      content: outputContent.value.trim(),
      subtask_id: selectedSubtaskId.value
    })
    
    // Reload task to check status after submit-output
    await loadTask()
    
    // For daily_management tasks that went to review (leader/admin initiated), auto-approve
    if (task.value.task_type === 'daily_management' && task.value.status === 'review') {
      await taskAPI.approveFinal(task.value.id, { approved: true, comment: '日常管理任务自动通过' })
      await loadTask()
    }
    
    outputContent.value = ''
    selectedSubtaskId.value = null
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}


async function handleRecallOutput(outputId) {
  if (!confirm('确定要撤回此输出物吗？')) return
  try {
    const data = await taskAPI.recallOutput(task.value.id, outputId)
    task.value = data.task
  } catch (e) {
    alert(e.message)
  }
}
onMounted(loadTask)
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
.card-hint { font-size: 12px; color: var(--text-secondary); margin: 0 0 16px 0; }
.required { color: var(--danger); }

.progress-header { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.progress-value { font-weight: 600; color: var(--primary); }
.progress-bar { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.progress-hint { font-size: 12px; color: var(--text-caption); margin-top: 8px; }

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.form-textarea {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; font-size: 14px; color: var(--text); outline: none;
  box-sizing: border-box; background: #fff; resize: vertical; font-family: inherit; min-height: 100px;
}
.form-textarea:focus { border-color: var(--primary); }

.output-list { display: flex; flex-direction: column; gap: 10px; }
.output-item { padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border); }
.output-item.output-approved { border-color: #b7eb8f; background: #f6ffed; }
.output-item.output-rejected { border-color: #ffa39e; background: #fff2f0; }
.output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.output-user { font-size: 13px; font-weight: 500; color: var(--text); }
.output-time { font-size: 12px; color: var(--text-caption); margin-left: auto; }
.output-content { font-size: 14px; color: var(--text); line-height: 1.5; white-space: pre-wrap; }
.output-review { font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.output-status-pending { color: #fa8c16; background: #fff7e6; }
.output-status-approved { color: #52c41a; background: #f6ffed; }
.output-status-rejected { color: #ff4d4f; background: #fff2f0; }

.subtask-list { display: flex; flex-direction: column; gap: 8px; }
.subtask-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafbfc; border-radius: 8px; }
.subtask-info { display: flex; flex-direction: column; gap: 2px; }
.subtask-title { font-size: 13px; font-weight: 500; color: var(--text); }
.subtask-assignee { font-size: 12px; color: var(--text-secondary); }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-sm { font-size: 11px; padding: 1px 6px; }
.tag-success { color: #52c41a; background: #f6ffed; }
.tag-default { color: #8c8c8c; background: #f5f5f5; }

.feedback-list { display: flex; flex-direction: column; gap: 14px; }
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

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }

.empty-state { color: var(--text-secondary); font-size: 14px; }

.form-select-subtask {
  width: 100%; height: 40px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 28px 0 10px; font-size: 13px; color: var(--text);
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer; outline: none; box-sizing: border-box;
}
.form-select-subtask:focus { border-color: var(--primary); }
</style>
