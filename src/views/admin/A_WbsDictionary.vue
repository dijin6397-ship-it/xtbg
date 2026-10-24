<template>
  <div class="wbs-page">
    <div class="page-header">
      <h2>WBS 字典维护</h2>
      <span class="summary">项目号（WBS元素） {{ projectCount }} 个 · 车号 {{ carCount }} 个</span>
      <div class="header-actions">
        <button class="btn btn-light" :disabled="saving" @click="downloadTemplate">📥 下载导入模板</button>
        <button class="btn btn-light" :disabled="saving" @click="triggerImport">📤 Excel批量导入</button>
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="file-input" @change="handleImportFile" />
      </div>
    </div>

    <div class="hint-bar">
      维护层级结构：<strong>项目WBS（如 N-A228） → 车号（四位数字，如 0289）</strong>。
      项目号可维护对应的<strong>项目名称</strong>（如 N-A228 → 02A01三架项目）。
      任务发布时「项目号（WBS元素）/ 车号」字段的数据即来源于此，均支持多选。
      批量扩充：下载 Excel 模板填写后「Excel批量导入」，已存在的项目号/车号不会重复创建。
    </div>

    <!-- 导入结果 -->
    <div v-if="importResult" class="card import-panel">
      <div class="import-panel-head">
        <strong>导入结果</strong>
        <button class="btn btn-sm" @click="importResult = null">关闭</button>
      </div>
      <p class="import-summary">
        共 {{ importResult.total }} 行：新增项目 <b class="ok">{{ importResult.createdProjects }}</b> 个，
        更新项目名称 <b class="ok">{{ importResult.updatedProjects }}</b> 个，
        新增车号 <b class="ok">{{ importResult.createdCars }}</b> 个，
        跳过（已存在/空行） {{ importResult.skipped }} 行
      </p>
      <div v-if="importResult.errors?.length" class="import-errors">
        <div class="import-errors-title">失败明细</div>
        <ul>
          <li v-for="(err, i) in importResult.errors" :key="i">
            <span class="err-row">第 {{ err.row }} 行</span>{{ err.message }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Add project -->
    <div class="card">
      <div class="add-row">
        <label class="add-label">新增项目号</label>
        <input v-model="newProjectCode" class="form-input" placeholder="请输入项目号（WBS元素），如 N-A228" @keyup.enter="createProject" />
        <input v-model="newProjectName" class="form-input" placeholder="项目名称（选填），如 02A01三架项目" @keyup.enter="createProject" />
        <button class="btn btn-primary" :disabled="saving" @click="createProject">新增项目</button>
      </div>
      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <!-- Tree -->
    <div class="card table-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="tree.length === 0" class="empty-state">
        <p>暂无项目WBS，请先在上方新增项目号</p>
      </div>
      <div v-else class="wbs-list">
        <div v-for="proj in tree" :key="proj.id" class="wbs-project">
          <div class="wbs-project-row">
            <button class="expand-toggle" @click="toggleExpand(proj.id)" :aria-label="expanded.has(proj.id) ? '折叠' : '展开'">
              {{ expanded.has(proj.id) ? '−' : '+' }}
            </button>
            <span class="tag tag-l1">项目WBS</span>

            <!-- 编辑态：项目号 + 项目名称 -->
            <template v-if="editingId === proj.id">
              <input v-model="editForm.code" class="form-input inline-input" placeholder="项目号" />
              <input v-model="editForm.projectName" class="form-input inline-input" placeholder="项目名称，如 02A01三架项目" />
              <div class="row-actions">
                <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveProjectEdit(proj)">保存</button>
                <button class="btn btn-sm" @click="cancelEdit">取消</button>
              </div>
            </template>
            <template v-else>
              <span class="proj-name">{{ proj.name }}</span>
              <span v-if="proj.code && proj.code !== proj.name" class="proj-code">{{ proj.code }}</span>
              <span class="proj-pname" :class="{ 'proj-pname-empty': !proj.projectName }">
                {{ proj.projectName || '未填项目名称' }}
              </span>
              <span class="car-count">车号 {{ (proj.children || []).length }}</span>
              <div class="row-actions">
                <button class="btn btn-sm" @click="startEditProject(proj)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="removeItem(proj)">删除</button>
              </div>
            </template>
          </div>

          <div v-if="expanded.has(proj.id)" class="wbs-cars">
            <div v-for="car in proj.children" :key="car.id" class="wbs-car-row">
              <span class="tag tag-l2">车号</span>
              <span class="car-name">{{ car.name }}</span>
              <div class="row-actions">
                <button class="btn btn-sm" @click="editItem(car)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="removeItem(car)">删除</button>
              </div>
            </div>

            <div class="add-car-row">
              <input
                v-model="carInputs[proj.id]"
                class="form-input"
                placeholder="新增车号（四位数字，如 0289）"
                maxlength="4"
                @keyup.enter="createCar(proj)"
              />
              <button class="btn btn-primary btn-sm" :disabled="saving" @click="createCar(proj)">新增车号</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { wbsAPI } from '../../api/index.js'

const tree = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const newProjectCode = ref('')
const newProjectName = ref('')
const carInputs = reactive({})
const expanded = ref(new Set())

// 项目行内编辑（项目号 + 项目名称）
const editingId = ref(null)
const editForm = reactive({ code: '', projectName: '' })

// Excel 批量导入
const fileInputRef = ref(null)
const importResult = ref(null)

const projectCount = computed(() => tree.value.length)
const carCount = computed(() => tree.value.reduce((n, p) => n + (p.children?.length || 0), 0))

function toggleExpand(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

async function loadTree() {
  loading.value = true
  try {
    const data = await wbsAPI.tree()
    tree.value = data.tree || []
    // 默认全部展开，便于查看车号
    expanded.value = new Set(tree.value.map(p => p.id))
  } catch (e) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

async function createProject() {
  const code = newProjectCode.value.trim()
  error.value = ''
  if (!code) { error.value = '请输入项目号（WBS元素）'; return }
  saving.value = true
  try {
    await wbsAPI.create({ level: 1, code, name: code, projectName: newProjectName.value.trim() })
    newProjectCode.value = ''
    newProjectName.value = ''
    await loadTree()
  } catch (e) {
    error.value = '新增失败: ' + e.message
  } finally {
    saving.value = false
  }
}

async function createCar(proj) {
  const code = String(carInputs[proj.id] || '').trim()
  error.value = ''
  if (!/^\d{4}$/.test(code)) { error.value = '车号必须为四位数字，例如 0289'; return }
  saving.value = true
  try {
    await wbsAPI.create({ level: 2, parentId: proj.id, code, name: code })
    carInputs[proj.id] = ''
    await loadTree()
  } catch (e) {
    error.value = '新增失败: ' + e.message
  } finally {
    saving.value = false
  }
}

function startEditProject(proj) {
  editingId.value = proj.id
  editForm.code = proj.code || proj.name || ''
  editForm.projectName = proj.projectName || ''
}

function cancelEdit() {
  editingId.value = null
  editForm.code = ''
  editForm.projectName = ''
}

async function saveProjectEdit(proj) {
  const code = editForm.code.trim()
  error.value = ''
  if (!code) { error.value = '项目号不能为空'; return }
  saving.value = true
  try {
    await wbsAPI.update(proj.id, { code, name: code, projectName: editForm.projectName.trim() })
    cancelEdit()
    await loadTree()
  } catch (e) {
    error.value = '修改失败: ' + e.message
  } finally {
    saving.value = false
  }
}

async function editItem(item) {
  error.value = ''
  const isCar = item.level === 2
  const next = window.prompt(isCar ? '修改车号（四位数字）' : '修改项目号（WBS元素）', item.name)
  if (next === null) return
  const val = next.trim()
  if (!val) { error.value = '名称不能为空'; return }
  if (isCar && !/^\d{4}$/.test(val)) { error.value = '车号必须为四位数字，例如 0289'; return }
  saving.value = true
  try {
    await wbsAPI.update(item.id, { code: val, name: val })
    await loadTree()
  } catch (e) {
    error.value = '修改失败: ' + e.message
  } finally {
    saving.value = false
  }
}

async function removeItem(item) {
  const isCar = item.level === 2
  const msg = isCar
    ? `确定要删除车号「${item.name}」？`
    : `确定要删除项目WBS「${item.name}」？其下所有车号也会被一并删除。`
  if (!confirm(msg)) return
  error.value = ''
  saving.value = true
  try {
    await wbsAPI.remove(item.id)
    await loadTree()
  } catch (e) {
    error.value = '删除失败: ' + e.message
  } finally {
    saving.value = false
  }
}

// ---------------- Excel 模板下载 / 批量导入 ----------------

async function downloadTemplate() {
  saving.value = true
  try {
    const blob = await wbsAPI.downloadTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wbs-import-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = e.message || '模板下载失败'
  } finally {
    saving.value = false
  }
}

function triggerImport() {
  fileInputRef.value?.click()
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  saving.value = true
  importResult.value = null
  error.value = ''
  try {
    const base64 = await readFileAsBase64(file)
    importResult.value = await wbsAPI.import(base64)
    await loadTree()
  } catch (e) {
    error.value = e.message || '导入失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadTree)
</script>

<style scoped>
.wbs-page { display: flex; flex-direction: column; gap: 16px; max-width: 1100px; }
.page-header { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%); color: #fff; padding: 16px; border-radius: var(--radius); flex-wrap: wrap; }
.page-header h2 { font-size: 20px; font-weight: 600; color: #fff; margin: 0; }
.summary { font-size: 13px; color: rgba(255,255,255,0.85); }
.header-actions { margin-left: auto; display: flex; gap: 8px; }
.btn-light { background: rgba(255,255,255,0.16); color: #fff; border-color: rgba(255,255,255,0.4); }
.btn-light:hover:not(:disabled) { background: rgba(255,255,255,0.28); }
.file-input { display: none; }

.hint-bar { font-size: 12px; color: var(--text-secondary); background: var(--primary-light, #e6f4ff); border-radius: 8px; padding: 10px 14px; line-height: 1.6; }
.hint-bar strong { color: var(--primary); }

.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); padding: 16px; }
.table-card { padding: 16px; }

.add-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.add-label { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; }

.form-input {
  flex: 1; min-width: 180px; height: 38px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 12px; font-size: 14px; color: var(--text); outline: none; box-sizing: border-box; background: #fff;
}
.form-input:focus { border-color: var(--primary); }
.inline-input { height: 32px; min-width: 120px; font-size: 13px; }

.wbs-list { display: flex; flex-direction: column; gap: 10px; }
.wbs-project { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.wbs-project-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: linear-gradient(90deg, #e6f4ff 0%, #ffffff 60px); flex-wrap: wrap; }
.proj-name { font-size: 14px; font-weight: 600; color: var(--text); }
.proj-code { font-size: 11px; color: var(--text-caption); }
.proj-pname { font-size: 12px; color: var(--primary); background: var(--primary-light, #e6f4ff); padding: 2px 8px; border-radius: 4px; }
.proj-pname-empty { color: var(--text-caption); background: #f5f5f5; }
.car-count { font-size: 12px; color: var(--text-secondary); }
.row-actions { margin-left: auto; display: flex; gap: 6px; flex-shrink: 0; }

.wbs-cars { padding: 8px 14px 12px 44px; border-top: 1px dashed var(--border); background: #fcfdff; }
.wbs-car-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.car-name { font-size: 13px; color: var(--text); font-family: monospace; }
.add-car-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.add-car-row .form-input { height: 34px; max-width: 280px; }

.expand-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: 1px solid var(--border); border-radius: 4px;
  background: #fff; color: var(--text); cursor: pointer; font-size: 16px; font-weight: 600; line-height: 1; flex-shrink: 0;
}
.expand-toggle:hover { border-color: var(--primary); color: var(--primary); }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-l1 { color: #1677ff; background: #e6f4ff; }
.tag-l2 { color: #52c41a; background: #f6ffed; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); transition: all 0.2s;
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff2f0; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg { color: #ff4d4f; font-size: 13px; margin-top: 10px; }
.loading-state, .empty-state { padding: 40px; text-align: center; color: var(--text-secondary); font-size: 14px; }

.import-panel { border: 1px solid var(--border); }
.import-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.import-panel-head strong { font-size: 14px; color: var(--text); }
.import-summary { margin: 0; font-size: 13px; color: var(--text); }
.import-summary .ok { color: #52c41a; }
.import-errors { margin-top: 12px; }
.import-errors-title { font-size: 13px; font-weight: 500; color: #ff4d4f; margin-bottom: 6px; }
.import-errors ul { margin: 0; padding-left: 18px; max-height: 240px; overflow-y: auto; }
.import-errors li { font-size: 12px; color: var(--text); line-height: 1.8; }
.import-errors .err-row { color: #ff4d4f; margin-right: 8px; white-space: nowrap; }
</style>
