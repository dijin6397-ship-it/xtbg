<template>
  <div class="page-wrap" v-if="task">
    <button class="back-btn" @click="$router.push(`/admin/task/${task.id}`)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      返回任务详情
    </button>

    <h2 class="page-title">申请完成</h2>
    <p class="page-desc">{{ task.title }}</p>

    <div class="card">
      <h3 class="card-title">子任务完成情况</h3>
      <div v-for="sub in task.subtasks" :key="sub.id" class="summary-row">
        <span class="check-icon" :class="{ done: sub.status === 'completed' }">
          <svg v-if="sub.status === 'completed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9cdd4" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
        </span>
        <div style="flex:1">
          <div :style="{ fontSize: '13px', color: sub.status === 'completed' ? 'var(--text-caption)' : 'var(--text)', textDecoration: sub.status === 'completed' ? 'line-through' : 'none' }">{{ sub.title }}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <span style="font-size:12px;color:var(--text-secondary)">{{ sub.assignee?.name }}</span>
            <div class="progress-bar" style="width:80px;height:4px"><div class="progress-bar-fill" :style="{ width: sub.progress + '%', background: 'var(--primary)' }"></div></div>
            <span style="font-size:12px;color:var(--text-secondary)">{{ sub.progress }}%</span>
          </div>
        </div>
      </div>
      <div v-if="!task.subtasks?.length" class="empty-hint">暂无子任务</div>
    </div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">完成说明</label>
        <textarea class="form-textarea" v-model="completionNote" placeholder="请输入任务完成说明" rows="4"></textarea>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交验收申请' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { taskAPI } from '../../api/index.js'

const route = useRoute()
const router = useRouter()
const task = ref(null)
const completionNote = ref('')
const submitting = ref(false)

async function loadTask() {
  const data = await taskAPI.get(Number(route.params.id))
  task.value = data.task
}

async function handleSubmit() {
  submitting.value = true
  try {
    await taskAPI.submitComplete(task.value.id, { note: completionNote.value })
    router.push(`/admin/task/${task.value.id}`)
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(loadTask)
</script>

<style scoped>
.page-wrap { max-width: 800px; }
.back-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; padding: 0; }
.back-btn:hover { color: var(--primary); }
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 4px 0; }
.page-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 20px 0; }
.card { background: #fff; border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 14px 0; }
.summary-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.summary-row:last-child { border-bottom: none; }
.check-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.check-icon.done { width: 22px; height: 22px; border-radius: 50%; background: #52c41a; }
.form-group { margin-bottom: 0; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.form-textarea { width: 100%; min-height: 100px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; }
.form-textarea:focus { border-color: var(--primary); }
.progress-bar { height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-bar { padding: 8px 0; }
.empty-hint { font-size: 13px; color: var(--text-caption); }
</style>
