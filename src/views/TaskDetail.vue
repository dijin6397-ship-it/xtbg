<template>
  <div class="page" v-if="task">
    <div class="page-header" style="padding-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer" @click="$router.back()">
        <span style="font-size:18px">\u2190</span>
        <span style="font-size:13px">\u8FD4\u56DE</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <span class="tag" :style="{ background: priority.bg, color: priority.color }">{{ priority.label }}</span>
        <span class="tag" :style="{ background: status.bg, color: status.color }">{{ status.label }}</span>
      </div>
      <h1 style="font-size:17px;line-height:1.4">{{ task.title }}</h1>
    </div>

    <!-- Progress -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;font-weight:500">\u4EFB\u52A1\u8FDB\u5EA6</span>
        <span style="font-size:13px;font-weight:600;color:var(--primary)">{{ task.progress }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: task.progress + '%', background: progressColor }"></div>
      </div>
    </div>

    <!-- Info -->
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:11px;color:var(--text-caption);margin-bottom:4px">\u53D1\u5E03\u4EBA</div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="avatar" :style="{ background: '#1677ff', width:'24px', height:'24px', fontSize:'10px' }">{{ task.publisher.name[0] }}</div>
            <span style="font-size:13px">{{ task.publisher.name }}</span>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-caption);margin-bottom:4px">\u8D23\u4EFB\u90E8\u95E8</div>
          <span style="font-size:13px">{{ task.department }}</span>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-caption);margin-bottom:4px">\u622A\u6B62\u65E5\u671F</div>
          <span style="font-size:13px" :style="{ color: isOverdue ? 'var(--danger)' : 'var(--text)' }">{{ task.deadline }}</span>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-caption);margin-bottom:4px">\u7763\u529E\u4EBA</div>
          <span style="font-size:13px">{{ task.supervisor.name }}</span>
        </div>
      </div>
    </div>

    <!-- Assignees -->
    <div class="card">
      <div style="font-size:13px;font-weight:500;margin-bottom:10px">\u8D23\u4EFB\u4EBA</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        <div v-for="u in task.assignees" :key="u.id" style="display:flex;align-items:center;gap:6px">
          <div class="avatar" :style="{ background: '#52c41a', width:'28px', height:'28px', fontSize:'11px' }">{{ u.name[0] }}</div>
          <span style="font-size:13px">{{ u.name }}</span>
          <span style="font-size:11px;color:var(--text-caption)">{{ u.dept }}</span>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="card">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px">\u4EFB\u52A1\u63CF\u8FF0</div>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.7">{{ task.description }}</p>
    </div>

    <!-- Tags -->
    <div class="card" v-if="task.tags.length">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px">\u6807\u7B7E</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <span v-for="tag in task.tags" :key="tag" class="tag" style="background:#e6f4ff;color:#1677ff">{{ tag }}</span>
      </div>
    </div>

    <!-- Milestones -->
    <div class="card">
      <div style="font-size:13px;font-weight:500;margin-bottom:12px">\u91CC\u7A0B\u7891</div>
      <div v-for="(m, i) in task.milestones" :key="i" style="display:flex;gap:10px;margin-bottom:12px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div :style="{ width:'16px', height:'16px', borderRadius:'50%', background: m.done ? '#52c41a' : '#e5e6eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#fff' }">{{ m.done ? '\u2713' : '' }}</div>
          <div v-if="i < task.milestones.length - 1" style="width:2px;flex:1;background:#e5e6eb;margin-top:2px"></div>
        </div>
        <div style="flex:1;padding-bottom:4px">
          <div :style="{ fontSize:'13px', fontWeight: m.done ? '400' : '500', color: m.done ? 'var(--text-caption)' : 'var(--text)', textDecoration: m.done ? 'line-through' : 'none' }">{{ m.title }}</div>
          <div style="font-size:11px;color:var(--text-caption);margin-top:2px">{{ m.date }}</div>
        </div>
      </div>
    </div>

    <!-- Comments -->
    <div class="card">
      <div style="font-size:13px;font-weight:500;margin-bottom:12px">\u52A8\u6001 ({{ task.comments.length }})</div>
      <div v-for="(c, i) in task.comments" :key="i" style="display:flex;gap:10px;margin-bottom:12px">
        <div class="avatar" :style="{ background: '#1677ff', width:'28px', height:'28px', fontSize:'10px' }">{{ c.user.name[0] }}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span style="font-size:13px;font-weight:500">{{ c.user.name }}</span>
            <span style="font-size:11px;color:var(--text-caption)">{{ c.time }}</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.5">{{ c.content }}</p>
        </div>
      </div>
      <div v-if="!task.comments.length" style="text-align:center;padding:16px;color:var(--text-caption);font-size:13px">\u6682\u65E0\u52A8\u6001</div>
    </div>

    <!-- Actions -->
    <div style="padding:12px 16px;display:flex;gap:10px">
      <button class="btn btn-outline" style="flex:1" @click="showUrgePanel = true">\u{1F4E2} \u50AC\u529E</button>
    </div>

    <!-- Urge Panel -->
    <Teleport to="body">
      <div v-if="showUrgePanel" class="slide-panel">
        <div class="slide-overlay" @click="showUrgePanel = false"></div>
        <div class="slide-content" style="padding:24px">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">\u53D1\u9001\u50AC\u529E\u901A\u77E5</h3>
          <div class="form-group">
            <label class="form-label">\u50AC\u529E\u5185\u5BB9</label>
            <textarea class="form-textarea" v-model="urgeMsg" placeholder="\u8BF7\u8F93\u5165\u50AC\u529E\u5185\u5BB9"></textarea>
          </div>
          <button class="btn btn-primary" @click="sendUrge">\u53D1\u9001</button>
        </div>
      </div>
    </Teleport>

  </div>

  <div v-else class="empty-state" style="padding-top:100px">
    <div class="icon">\u{1F50D}</div>
    <p>\u4EFB\u52A1\u4E0D\u5B58\u5728</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { tasks, priorityMap, statusMap } from '../mock/data.js'

const route = useRoute()
const task = computed(() => tasks.find(t => t.id === Number(route.params.id)))

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

const showUrgePanel = ref(false)
const urgeMsg = ref('')

function sendUrge() {
  showUrgePanel.value = false
  urgeMsg.value = ''
}

function submitProgress() {
  if (task.value) task.value.progress = newProgress.value
  showProgressPanel.value = false
}
</script>
