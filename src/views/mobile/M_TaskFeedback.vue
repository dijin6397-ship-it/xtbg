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
        <label class="form-label">任务分类 *</label>
        <CategoryCascader v-model="category" />
      </div>

      <div class="form-group">
        <label class="form-label">输出物内容 *</label>
        <textarea class="form-textarea" v-model="outputContent" placeholder="请输入输出物内容..." rows="5"></textarea>
      </div>

      <!-- Self-scoring section -->
      <div class="form-group" v-if="selectedL3Info">
        <label class="form-label">自行评分 *</label>
        <div class="score-rule-hint">
          <span class="tag" :class="'rule-' + (selectedL3Info.scoreRule || 'fixed')">{{ ruleLabel(selectedL3Info.scoreRule) }}</span>
          <span v-if="selectedL3Info.scoreRule === 'fixed'" class="rule-text">≤ {{ selectedL3Info.scoreValue }}</span>
          <span v-if="selectedL3Info.scoreRule === 'range'" class="rule-text">{{ selectedL3Info.scoreValue }} - {{ selectedL3Info.scoreUpper }}</span>
          <span v-if="selectedL3Info.scoreRule === 'any'" class="rule-text">任意</span>
        </div>
        <div class="score-input-row">
          <div class="score-cell">
            <label class="score-cell-label">分数</label>
            <input v-model.number="selfScoreValue" type="number" step="0.5" min="0" class="score-input" placeholder="分数" />
          </div>
          <div class="score-cell">
            <label class="score-cell-label">数量</label>
            <input v-model.number="selfScoreQty" type="number" step="0.5" min="0.5" class="score-input" placeholder="数量" />
          </div>
          <div class="score-cell score-total-cell">
            <label class="score-cell-label">总分</label>
            <div class="score-total-display">{{ selfScoreTotal }}</div>
          </div>
        </div>
      </div>

      <button class="btn btn-primary" @click="handleSubmit" :disabled="!canSubmit || submitting">
        {{ submitting ? '提交中...' : '提交输出物' }}
      </button>
    </div>

    <!-- Existing Outputs -->
    <div class="card" v-if="task.outputs?.length">
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 12px">已提交的输出物 ({{ task.outputs.length }})</div>
      <div v-for="out in task.outputs" :key="out.id" class="m-output-item" :class="'output-' + out.status">
        <div class="m-output-header">
          <span class="output-user">{{ out.submitter?.name }}</span>
          <span class="output-time">{{ out.createdAt }}</span>
          <span class="tag tag-sm" :class="'output-status-' + out.status">
            {{ { pending: '待审核', approved: '已通过', rejected: '已退回' }[out.status] }}
          </span>
        </div>
        <div v-if="out.categoryL1Name" class="output-category-text">{{ out.categoryL1Name }} / {{ out.categoryL2Name }} / {{ out.categoryL3Name }}</div>
        <div class="output-content">{{ out.content }}</div>
        <div v-if="out.scoreTotal > 0" class="output-score-display">
          分值：{{ out.scoreValue }} × {{ out.scoreQuantity }} = {{ out.scoreTotal }}
        </div>
        <div v-if="out.reviewComment" class="output-review">审核意见: {{ out.reviewComment }}</div>
      </div>
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
  </div>

  <div v-else class="empty-state" style="padding-top: 100px">
    <p>{{ loading ? '加载中...' : '任务不存在' }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { taskAPI } from '../../api/index.js'
import CategoryCascader from '../../components/CategoryCascader.vue'

const route = useRoute()
const router = useRouter()

const task = ref(null)
const loading = ref(true)
const submitting = ref(false)
const outputContent = ref('')
const category = ref({ l1: null, l2: null, l3: null, rule: null })
const selfScoreValue = ref(0)
const selfScoreQty = ref(1)

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

function ruleLabel(rule) {
  return { fixed: '单值', range: '区间', any: '任意' }[rule] || ''
}

const selectedL3Info = computed(() => {
  if (!category.value.l3) return null
  const rule = category.value.rule
  if (!rule) return null
  return {
    scoreRule: rule.scoreRule || rule.score_rule || 'fixed',
    scoreValue: rule.scoreValue ?? rule.score_value ?? 0,
    scoreUpper: rule.scoreUpper ?? rule.score_upper ?? 0
  }
})

const selfScoreTotal = computed(() => {
  const total = (selfScoreValue.value || 0) * (selfScoreQty.value || 0)
  return Math.round(total * 100) / 100
})

const canSubmit = computed(() => {
  if (!outputContent.value.trim() || !category.value.l1 || !category.value.l2 || !category.value.l3) return false
  if (task.value?.task_type === 'daily_management') {
    return selfScoreValue.value > 0 && selfScoreQty.value > 0
  }
  return true
})

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

async function handleSubmit() {
  if (!outputContent.value.trim()) return
  if (!category.value.l1 || !category.value.l2 || !category.value.l3) {
    alert('请选择一/二/三级分类')
    return
  }
  if (task.value?.task_type === 'daily_management') {
    if (!selfScoreValue.value || selfScoreValue.value <= 0) {
      alert('请填写分数')
      return
    }
    if (!selfScoreQty.value || selfScoreQty.value <= 0) {
      alert('请填写数量')
      return
    }
  }
  submitting.value = true
  try {
    const payload = {
      content: outputContent.value.trim(),
      category_l1: category.value.l1,
      category_l2: category.value.l2,
      category_l3: category.value.l3
    }
    if (task.value?.task_type === 'daily_management' && selfScoreValue.value > 0) {
      payload.score_value = selfScoreValue.value
      payload.score_quantity = selfScoreQty.value
    }
    await taskAPI.submitOutput(task.value.id, payload)
    await loadTask()
    outputContent.value = ''
    category.value = { l1: null, l2: null, l3: null, rule: null }
    selfScoreValue.value = 0
    selfScoreQty.value = 1
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(loadTask)
</script>

<style scoped>
.m-back-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-sm { font-size: 11px; padding: 1px 6px; }
.tag-success { color: #52c41a; background: #f6ffed; }
.tag-default { color: #8c8c8c; background: #f5f5f5; }

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.form-textarea {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; font-size: 14px; color: var(--text); outline: none;
  box-sizing: border-box; background: #fff; resize: vertical; font-family: inherit; min-height: 100px;
}
.form-textarea:focus { border-color: var(--primary); }

.score-rule-hint {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #fafbfc; border-radius: 6px; margin-bottom: 10px; font-size: 12px;
}
.rule-text { color: var(--text); font-weight: 500; }
.score-input-row { display: flex; gap: 10px; }
.score-cell { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.score-cell-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.score-input {
  width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 10px; font-size: 14px; color: var(--text); outline: none; box-sizing: border-box;
}
.score-input:focus { border-color: var(--primary); }
.score-total-cell { flex: 0 0 80px; }
.score-total-display {
  height: 36px; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: var(--primary);
  background: #e6f4ff; border-radius: 8px;
}

.rule-fixed { color: #fa8c16; background: #fff7e6; }
.rule-range { color: #1677ff; background: #e6f4ff; }
.rule-any { color: #8c8c8c; background: #f5f5f5; }

.m-output-item {
  padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px; background: #fff;
}
.m-output-item.output-approved { border-color: #b7eb8f; background: #f6ffed; }
.m-output-item.output-rejected { border-color: #ffa39e; background: #fff2f0; }
.m-output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.output-user { font-size: 13px; font-weight: 500; color: var(--text); }
.output-time { font-size: 12px; color: var(--text-caption); margin-left: auto; }
.output-category-text { font-size: 12px; color: var(--primary); margin-bottom: 6px; }
.output-content { font-size: 14px; color: var(--text); line-height: 1.5; }
.output-score-display { font-size: 12px; color: var(--primary); font-weight: 600; margin-top: 6px; }
.output-review { font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.output-status-pending { color: #fa8c16; background: #fff7e6; }
.output-status-approved { color: #52c41a; background: #f6ffed; }
.output-status-rejected { color: #ff4d4f; background: #fff2f0; }
</style>
