<template>
  <div class="page" v-if="task">
    <!-- Header -->
    <div class="page-header" style="padding-bottom: 16px">
      <div class="m-back-row" @click="$router.back()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style="font-size: 13px">返回</span>
      </div>
      <h1 style="font-size: 17px; line-height: 1.4">任务分解</h1>
      <p style="font-size: 12px; opacity: 0.85; margin-top: 4px">{{ task.title }}</p>
    </div>

    <!-- Task Summary -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px">任务摘要</div>
      <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px">{{ task.description }}</p>
      <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-caption)">
        <span>截止: {{ task.deadline }}</span>
        <span>优先级: {{ getPriority(task).label }}</span>
      </div>
    </div>

    <!-- Existing Subtasks -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">已有子任务 ({{ task.subtasks.length }})</div>
      <div v-if="task.subtasks.length">
        <div v-for="sub in task.subtasks" :key="sub.id" class="m-subtask-item">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="display: flex; align-items: center; gap: 8px">
              <div class="avatar" :style="{ background: '#722ed1', width: '28px', height: '28px', fontSize: '11px' }">{{ sub.assignee.name[0] }}</div>
              <div>
                <div style="font-size: 13px; font-weight: 500">{{ sub.title }}</div>
                <div style="font-size: 11px; color: var(--text-caption)">{{ sub.assignee.name }}</div>
              </div>
            </div>
            <span class="tag" :style="{ background: getStatus(sub).bg, color: getStatus(sub).color }">{{ getStatus(sub).label }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state" style="padding: 24px 0">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        <p style="font-size: 13px">暂无子任务，请添加</p>
      </div>
    </div>

    <!-- Add Subtask Form -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 10px">添加子任务</div>
      <div class="form-group">
        <label class="form-label">子任务标题</label>
        <input class="form-input" v-model="newSubtask.title" placeholder="请输入子任务标题" />
      </div>
      <div class="form-group">
        <label class="form-label">负责人</label>
        <select class="form-select" v-model="newSubtask.assigneeId">
          <option :value="null" disabled>请选择负责人</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.dept }})</option>
        </select>
      </div>
      <button class="btn btn-outline" style="width: 100%" @click="addSubtask" :disabled="!canAdd">确认添加</button>
    </div>

    <!-- Finish Button -->
    <div style="padding: 12px 16px 24px">
      <button class="btn btn-primary" @click="finishDecompose" :disabled="!task.subtasks.length">完成分解</button>
    </div>
  </div>

  <div v-else class="empty-state" style="padding-top: 100px">
    <p>任务不存在</p>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, users, priorityMap, statusMap, addSubtasks, updateTaskStatus } from '../../store/tasks.js'

const route = useRoute()
const router = useRouter()

const task = computed(() => store.tasks.find(t => t.id === Number(route.params.id)))

function getPriority(t) { return priorityMap[t.priority] || {} }
function getStatus(t) { return statusMap[t.status] || {} }

const newSubtask = reactive({ title: '', assigneeId: null })

const canAdd = computed(() => newSubtask.title.trim() && newSubtask.assigneeId !== null)

function addSubtask() {
  if (!canAdd.value || !task.value) return
  const user = users.find(u => u.id === newSubtask.assigneeId)
  if (!user) return

  addSubtasks(task.value.id, [{
    title: newSubtask.title.trim(),
    assignee: user
  }])

  newSubtask.title = ''
  newSubtask.assigneeId = null
}

function finishDecompose() {
  if (!task.value) return
  if (task.value.status === 'pending') {
    updateTaskStatus(task.value.id, 'decomposing')
  }
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
.m-subtask-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.m-subtask-item:last-child {
  border-bottom: none;
}
</style>
