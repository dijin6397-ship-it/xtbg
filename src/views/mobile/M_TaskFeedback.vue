<template>
  <div class="page" v-if="task">
    <!-- Header -->
    <div class="page-header" style="padding-bottom: 16px">
      <div class="m-back-row" @click="$router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style="font-size: 13px">返回</span>
      </div>
      <h1 style="font-size: 17px; line-height: 1.4">提交输出物</h1>
      <p style="font-size: 12px; opacity: 0.85; margin-top: 4px">{{ task.title }}</p>
    </div>

    <!-- Current Progress -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px">
        <span style="font-size: 13px; font-weight: 500">当前进度</span>
        <span style="font-size: 13px; font-weight: 600; color: var(--primary)">{{ task.progress }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: progressColor }"></div>
      </div>
      <div v-if="task.subtasks?.length" style="font-size: 12px; color: var(--text-caption); margin-top: 8px">
        已完成 {{ completedCount }}/{{ task.subtasks.length }} 个子任务
      </div>
    </div>

    <!-- Output Form -->
    <div class="card">
      <div class="form-group">
        <label class="form-label">输出物内容 *</label>
        <textarea class="form-textarea" v-model="outputContent" placeholder="请输入输出物内容..." rows="5"></textarea>
      </div>

      <button class="btn btn-primary" @click="handleSubmit" :disabled="!outputContent.trim()">提交输出物</button>
    </div>

    <!-- Subtasks Status -->
    <div class="card" v-if="task.subtasks?.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">子任务进度</div>
      <div v-for="sub in task.subtasks" :key="sub.id" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafbfc; border-radius: 8px; margin-bottom: 8px">
        <div>
          <div style="font-size: 13px; font-weight: 500">{{ sub.title }}</div>
          <div style="font-size: 12px; color: var(--text-secondary)">{{ sub.assignee?.name || '未分配' }}</div>
        </div>
        <span class="tag" :class="sub.status === 'completed' ? 'tag-success' : 'tag-default'">
          {{ sub.status === 'completed' ? '已完成' : '进行中' }}
        </span>
      </div>
    </div>

    <!-- History -->
    <div class="card" v-if="task.feedbacks?.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">历史反馈</div>
      <div v-for="fb in task.feedbacks" :key="fb.id" class="m-feedback-item">
        <div class="avatar" :style="{ background: '#1677ff', width: '28px', height: '28px', fontSize: '11px' }">{{ fb.user?.name?.[0] || '?' }}</div>
        <div style="flex: 1">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
            <span style="font-size: 13px; font-weight: 500">{{ fb.user?.name }}</span>
            <span style="font-size: 11px; color: var(--text-caption)">{{ fb.time }}</span>
          </div>
          <span class="tag" :style="feedbackTypeStyle(fb.type)" style="margin-bottom: 4px">{{ feedbackTypeLabel(fb.type) }}</span>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5">{{ fb.content }}</p>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty-state" style="padding-top: 100px">
    <p>任务不存在</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, addFeedback, updateTaskStatus } from '../../store/tasks.js'

const route = useRoute()
const router = useRouter()

const task = computed(() => store.tasks.find(t => t.id === Number(route.params.id)))

const outputContent = ref('')

const progressColor = computed(() => {
  const p = task.value?.progress || 0
  if (p >= 80) return '#52c41a'
  if (p >= 50) return '#1677ff'
  if (p >= 20) return '#fa8c16'
  return '#ff4d4f'
})

const completedCount = computed(() => {
  return task.value?.subtasks?.filter(s => s.status === 'completed').length || 0
})

function feedbackTypeLabel(type) {
  const map = { progress: '进度更新', issue: '问题反馈', complete: '完成报告', output: '输出物', comment: '评论' }
  return map[type] || type
}

function feedbackTypeStyle(type) {
  const map = {
    progress: { background: '#e6f4ff', color: '#1677ff' },
    issue: { background: '#fff7e6', color: '#fa8c16' },
    complete: { background: '#f6ffed', color: '#52c41a' },
    output: { background: '#e6fffb', color: '#13c2c2' },
    comment: { background: '#f5f5f5', color: '#8c8c8c' }
  }
  return map[type] || {}
}

function handleSubmit() {
  if (!outputContent.value.trim() || !task.value) return

  addFeedback(task.value.id, { type: 'output', content: outputContent.value.trim() })

  // For daily_management tasks, directly complete without review
  if (task.value.task_type === 'daily_management') {
    // Mark task as completed directly
    updateTaskStatus(task.value.id, 'completed')
  }

  outputContent.value = ''
  router.push(`/m/task/${task.value.id}`)
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
.m-feedback-item {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.m-feedback-item:last-child {
  margin-bottom: 0;
}
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-success { color: #52c41a; background: #f6ffed; }
.tag-default { color: #8c8c8c; background: #f5f5f5; }
</style>
