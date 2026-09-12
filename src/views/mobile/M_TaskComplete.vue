<template>
  <div class="page" v-if="task">
    <!-- Header -->
    <div class="page-header" style="padding-bottom: 16px">
      <div class="m-back-row" @click="$router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style="font-size: 13px">返回</span>
      </div>
      <h1 style="font-size: 17px; line-height: 1.4">申请完成</h1>
      <p style="font-size: 12px; opacity: 0.85; margin-top: 4px">{{ task.title }}</p>
    </div>

    <!-- Milestone Summary -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">里程碑完成情况</div>
      <div v-for="(m, i) in task.milestones" :key="i" class="m-summary-row">
        <span class="m-check-icon" :class="{ done: m.done }">
          <svg v-if="m.done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
        </span>
        <span :style="{ fontSize: '13px', color: m.done ? 'var(--text-caption)' : 'var(--text)', textDecoration: m.done ? 'line-through' : 'none' }">{{ m.title }}</span>
      </div>
    </div>

    <!-- Subtask Summary -->
    <div class="card" v-if="task.subtasks.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">子任务完成情况</div>
      <div v-for="sub in task.subtasks" :key="sub.id" class="m-summary-row">
        <span class="m-check-icon" :class="{ done: sub.status === 'completed' }">
          <svg v-if="sub.status === 'completed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
        </span>
        <div style="flex: 1">
          <span :style="{ fontSize: '13px', color: sub.status === 'completed' ? 'var(--text-caption)' : 'var(--text)', textDecoration: sub.status === 'completed' ? 'line-through' : 'none' }">{{ sub.title }}</span>
          <div class="progress-bar" style="margin-top: 4px">
            <div class="progress-bar-fill" :style="{ width: sub.progress + '%', background: '#1677ff' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Completion Note -->
    <div class="card">
      <div class="form-group">
        <label class="form-label">完成说明</label>
        <textarea class="form-textarea" v-model="completionNote" placeholder="请输入任务完成说明" rows="4"></textarea>
      </div>
    </div>

    <!-- Submit -->
    <div style="padding: 12px 16px 24px">
      <button class="btn btn-primary" @click="handleSubmit">提交验收申请</button>
    </div>
  </div>

  <div v-else class="empty-state" style="padding-top: 100px">
    <p>任务不存在</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, submitCompleteRequest, addFeedback } from '../../store/tasks.js'

const route = useRoute()
const router = useRouter()

const task = computed(() => store.tasks.find(t => t.id === Number(route.params.id)))
const completionNote = ref('')

function handleSubmit() {
  if (!task.value) return
  if (completionNote.value.trim()) {
    addFeedback(task.value.id, { type: 'complete', content: completionNote.value })
  }
  submitCompleteRequest(task.value.id)
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
.m-summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.m-check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.m-check-icon.done {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #52c41a;
}
</style>
