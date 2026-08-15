<template>
  <div class="page">
    <div class="page-header">
      <h1>发布任务</h1>
      <p>创建并分配新任务</p>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="form-group">
        <label class="form-label">任务标题 *</label>
        <input class="form-input" v-model="form.title" placeholder="请输入任务标题" />
      </div>

      <div class="form-group">
        <label class="form-label">任务描述 *</label>
        <textarea class="form-textarea" v-model="form.description" placeholder="请输入任务详细描述"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">责任部门</label>
        <select class="form-select" v-model="form.department">
          <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">指派给</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <span v-for="u in users" :key="u.id" class="filter-tab" :class="{ active: form.assignees.includes(u.id) }" @click="toggleAssignee(u.id)">
            {{ u.name }}
          </span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input class="form-input" type="date" v-model="form.deadline" />
      </div>

      <div class="form-group">
        <label class="form-label">督办人</label>
        <select class="form-select" v-model="form.supervisor">
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.dept }})</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">标签</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          <span v-for="tag in form.tags" :key="tag" class="tag" style="background:#e6f4ff;color:#1677ff;cursor:pointer" @click="removeTag(tag)">{{ tag }} ×</span>
        </div>
        <div style="display:flex;gap:8px">
          <input class="form-input" v-model="newTag" placeholder="输入标签" style="flex:1" @keyup.enter="addTag" />
          <button class="btn btn-outline btn-sm" @click="addTag">添加</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">里程碑</label>
        <div v-for="(m, i) in form.milestones" :key="i" style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
          <input class="form-input" v-model="m.title" placeholder="里程碑名称" style="flex:1" />
          <input class="form-input" type="date" v-model="m.date" style="width:130px;flex:none" />
          <span style="cursor:pointer;color:var(--danger);font-size:16px" @click="form.milestones.splice(i, 1)">×</span>
        </div>
        <button class="btn btn-outline btn-sm" @click="form.milestones.push({ title: '', date: '' })">+ 添加里程碑</button>
      </div>

      <button class="btn btn-primary" @click="publish" style="margin-top:8px">发布任务</button>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccess" class="slide-panel">
      <div class="slide-overlay" @click="showSuccess = false"></div>
      <div class="slide-content" style="padding:32px 24px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">✅</div>
        <h2 style="font-size:18px;font-weight:600;margin-bottom:8px">任务发布成功</h2>
        <p style="color:var(--text-secondary);margin-bottom:20px">任务已通知相关责任人</p>
        <button class="btn btn-primary" @click="resetForm" style="max-width:200px;margin:0 auto">继续发布</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { users, departments } from '../mock/data.js'

const newTag = ref('')
const showSuccess = ref(false)

const form = reactive({
  title: '', description: '', department: departments[0],
  assignees: [], deadline: '', supervisor: users[0].id, tags: []
})

function toggleAssignee(id) {
  const idx = form.assignees.indexOf(id)
  if (idx >= 0) form.assignees.splice(idx, 1)
  else form.assignees.push(id)
}

function addTag() {
  const t = newTag.value.trim()
  if (t && !form.tags.includes(t)) { form.tags.push(t); newTag.value = '' }
}

function removeTag(tag) { form.tags = form.tags.filter(t => t !== tag) }

function publish() {
  if (!form.title.trim() || !form.description.trim()) return
  showSuccess.value = true
}

function resetForm() {
  Object.assign(form, { title: '', description: '', department: departments[0], assignees: [], deadline: '', supervisor: users[0].id, tags: [] })
  showSuccess.value = false
}
</script>
