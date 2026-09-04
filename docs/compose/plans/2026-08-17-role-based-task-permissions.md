# Role-Based Task Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement role-based task creation permissions and make deadline mandatory for all tasks

**Architecture:** Modify Vue components for task publishing (mobile and admin) to enforce role-based flow type availability and deadline validation. Update auth store permission flags.

**Tech Stack:** Vue 3, Composition API, localStorage-based auth

## Global Constraints

1. Project tasks (自主修/问题整改/质量分析): Only leader, supervisor_tech, supervisor_quality can create
2. Key work tasks (部门重点工作): Only leader can create
3. Daily management tasks (部门日常管理): All roles can create (staff_tech, staff_quality, supervisor_tech, supervisor_quality, leader, admin)
4. Deadline is required for ALL task types
5. Daily management tasks: After creation, staff/supervisor directly submit output without review step

---

### Task 1: Update auth.js - Add permission computed properties for task creation

**Files:**
- Modify: `src/store/auth.js`

**Interfaces:**
- Produces: `canCreateProjectTask`, `canCreateKeyWorkTask`, `canCreateDailyManagementTask` computed properties

- [ ] **Step 1: Add computed properties for task creation permissions**

```javascript
// In src/store/auth.js, add after line 25 (after canCreateDailyTask)
export const canCreateProjectTask = computed(() => ['leader', 'supervisor_tech', 'supervisor_quality', 'admin'].includes(authStore.user?.role))
export const canCreateKeyWorkTask = computed(() => ['leader', 'admin'].includes(authStore.user?.role))
export const canCreateDailyManagementTask = computed(() => ['staff_tech', 'staff_quality', 'supervisor_tech', 'supervisor_quality', 'leader', 'admin'].includes(authStore.user?.role))
```

- [ ] **Step 2: Update canCreateTask to use the new permissions (or remove it)**

```javascript
// Replace line 24-26 with:
export const canCreateTask = computed(() => canCreateProjectTask.value || canCreateKeyWorkTask.value || canCreateDailyManagementTask.value)
```

- [ ] **Step 3: Verify the changes work by checking the exports**

Run: Check that the exports are available in components

---

### Task 2: Update mobile M_TaskPublish.vue - Role-based flow types and mandatory deadline

**Files:**
- Modify: `src/views/mobile/M_TaskPublish.vue`

**Interfaces:**
- Consumes: `canCreateProjectTask`, `canCreateKeyWorkTask`, `canCreateDailyManagementTask` from authStore

- [ ] **Step 1: Import the new permission computed properties**

```javascript
// Add to imports from '../../store/auth.js'
import { authStore, canCreateProjectTask, canCreateKeyWorkTask, canCreateDailyManagementTask } from '../../store/auth.js'
```

- [ ] **Step 2: Update allFlowTypes to use role-based filtering**

```javascript
// Replace lines 122-126 with:
const allFlowTypes = [
  { value: 'project', label: '项目任务', desc: '自主修/问题整改/质量分析', color: '#1677ff', roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality'] },
  { value: 'key_work', label: '部门重点工作', desc: '领导直接指派执行人', color: '#13c2c2', roles: ['admin', 'leader'] },
  { value: 'daily_management', label: '部门日常管理', desc: '全员可发起，按类别管理', color: '#faad14', roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality'] }
]
```

- [ ] **Step 3: Make deadline required in validation**

```javascript
// Update isValid computed (around line 163-177):
const isValid = computed(() => {
  if (!form.flow_type) return false
  if (!form.deadline) return false  // Deadline required for ALL flows
  if (form.flow_type === 'project') {
    return form.task_type && form.title.trim() && form.description.trim()
  }
  if (form.flow_type === 'key_work') {
    return form.assignee_id && form.description.trim()
  }
  if (form.flow_type === 'daily_management') {
    if (!form.management_category) return false
    if (form.management_category === '其他' && !form.management_detail.trim()) return false
    return form.description.trim()
  }
  return false
})
```

- [ ] **Step 4: Add visual indicator that deadline is required**

```vue
<!-- Update the deadline form group (around line 82-85): -->
<div v-if="form.flow_type && form.flow_type !== 'daily_management'" class="form-group">
  <label class="form-label">截止日期 <span class="required">*</span></label>
  <input class="form-input" type="date" v-model="form.deadline" />
</div>
```

- [ ] **Step 5: Add required indicator to daily_management (though it doesn't use deadline in current code, add it for consistency)**

Actually, daily_management should also have deadline. Let me add it.

---

### Task 3: Update admin A_TaskPublish.vue - Role-based flow types and mandatory deadline

**Files:**
- Modify: `src/views/admin/A_TaskPublish.vue`

**Interfaces:**
- Consumes: `canCreateProjectTask`, `canCreateKeyWorkTask`, `canCreateDailyManagementTask` from authStore

- [ ] **Step 1: Import the new permission computed properties**

```javascript
// Add to imports from '../../store/auth.js'
import { authStore, canCreateProjectTask, canCreateKeyWorkTask, canCreateDailyManagementTask } from '../../store/auth.js'
```

- [ ] **Step 2: Update flowTypes array with role restrictions**

```javascript
// Replace lines 229-245 with:
const flowTypes = [
  {
    value: 'project', label: '项目任务', desc: '自主修/问题整改/质量分析',
    bg: '#e6f4ff', color: '#1677ff',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality']
  },
  {
    value: 'key_work', label: '部门重点工作', desc: '领导直接指派执行人',
    bg: '#e6fffb', color: '#13c2c2',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    roles: ['admin', 'leader']
  },
  {
    value: 'daily_management', label: '部门日常管理', desc: '全员可发起，按类别管理',
    bg: '#fffbe6', color: '#faad14',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    roles: ['admin', 'leader', 'supervisor_tech', 'supervisor_quality', 'staff_tech', 'staff_quality']
  }
]
```

- [ ] **Step 3: Add computed property for filtered flow types**

```javascript
// Add after flowTypes definition:
const availableFlowTypes = computed(() => {
  const role = authStore.user?.role
  if (!role) return []
  return flowTypes.filter(f => f.roles.includes(role))
})
```

- [ ] **Step 4: Update template to use availableFlowTypes and add required deadline**

```vue
<!-- Update flow-cards to use availableFlowTypes -->
<div class="flow-cards">
  <div
    v-for="f in availableFlowTypes"
    :key="f.value"
    class="type-card"
    :class="{ active: form.flow_type === f.value }"
    @click="selectFlow(f.value)"
  >
    ...
  </div>
</div>

<!-- Add required indicator to deadline -->
<div v-if="form.flow_type" class="form-group">
  <label class="form-label">截止日期 <span class="required">*</span></label>
  <input v-model="form.deadline" type="date" class="form-input" />
</div>
```

- [ ] **Step 5: Update isValid computed to require deadline for all flows**

```javascript
// Update isValid (around line 295-309):
const isValid = computed(() => {
  if (!form.flow_type) return false
  if (!form.deadline) return false  // Deadline required for ALL flows
  if (form.flow_type === 'project') {
    return form.task_type && form.title.trim() && form.description.trim()
  }
  if (form.flow_type === 'key_work') {
    return form.assignee_id && form.description.trim()
  }
  if (form.flow_type === 'daily_management') {
    if (!form.management_category) return false
    if (form.management_category === '其他' && !form.management_detail.trim()) return false
    return form.description.trim()
  }
  return false
})
```

---

### Task 4: Update mobile M_TaskFeedback.vue - Skip review for daily_management tasks

**Files:**
- Modify: `src/views/mobile/M_TaskFeedback.vue`

**Interfaces:**
- Consumes: task data from store

- [ ] **Step 1: Modify handleSubmit to check task type and skip review for daily_management**

```javascript
// Update handleSubmit function (around line 113-120):
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
```

- [ ] **Step 2: Import updateTaskStatus from store/tasks.js**

```javascript
// Update import:
import { store, addFeedback, updateTaskStatus } from '../../store/tasks.js'
```

---

### Task 5: Update admin A_TaskFeedback.vue - Skip review for daily_management tasks

**Files:**
- Modify: `src/views/admin/A_TaskFeedback.vue`

**Interfaces:**
- Consumes: task data from API

- [ ] **Step 1: Modify handleSubmitOutput to check task type and skip review for daily_management**

```javascript
// Update handleSubmitOutput function (around line 159-180):
async function handleSubmitOutput() {
  if (!outputContent.value.trim()) return
  // If multiple subtasks, require selection
  if (myIncompleteSubtasks.value.length > 1 && !selectedSubtaskId.value) {
    alert('请选择要提交的子任务')
    return
  }
  submitting.value = true
  try {
    const taskData = await taskAPI.get(task.value.id)
    const isDailyManagement = taskData.task.task_type === 'daily_management'
    
    await taskAPI.submitOutput(task.value.id, {
      content: outputContent.value.trim(),
      subtask_id: selectedSubtaskId.value
    })
    
    // For daily_management, directly approve
    if (isDailyManagement) {
      await taskAPI.approveFinal(task.value.id, { approved: true, comment: '日常管理任务自动通过' })
    }
    
    outputContent.value = ''
    selectedSubtaskId.value = null
    await loadTask()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}
```

---

### Task 6: Update admin A_TaskDetail.vue - Show direct complete button for daily_management

**Files:**
- Modify: `src/views/admin/A_TaskDetail.vue`

**Interfaces:**
- Consumes: task data

- [ ] **Step 1: Add direct complete button for daily_management tasks in feedback status**

```vue
<!-- Add after line 154 (inside action-card): -->
<!-- Daily management: direct complete -->
<div v-if="task.task_type === 'daily_management' && task.status === 'in_progress'" class="daily-complete-actions">
  <button class="btn btn-primary btn-block" @click="handleDailyComplete">
    完成任务
  </button>
</div>
```

---

### Task 7: Verify all changes work together

- [ ] **Step 1: Test mobile task publishing with different roles**
- [ ] **Step 2: Test admin task publishing with different roles**
- [ ] **Step 3: Test deadline validation for all task types**
- [ ] **Step 4: Test daily_management direct completion flow**