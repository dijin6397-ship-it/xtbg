<template>
  <div class="wbs-selector">
    <div class="wbs-toolbar">
      <input v-model="keyword" type="text" class="wbs-search" placeholder="搜索项目号 / 车号..." />
      <span class="wbs-count">已选 {{ selectedProjects.length }} 个项目号 · {{ selectedCars.length }} 个车号</span>
      <button v-if="selectedProjects.length || selectedCars.length" type="button" class="wbs-clear" @click="clearAll">清空</button>
    </div>

    <div v-if="loading" class="wbs-empty">加载中...</div>
    <div v-else-if="visibleProjects.length === 0" class="wbs-empty">
      暂无 WBS 字典数据，请先到「WBS字典维护」中添加项目号与车号
    </div>
    <div v-else class="wbs-tree">
      <div v-for="proj in visibleProjects" :key="proj.id" class="wbs-project">
        <div class="wbs-project-row">
          <label class="wbs-check">
            <input
              type="checkbox"
              :checked="isProjectSelected(proj.id)"
              @change="toggleProject(proj)"
            />
            <span class="wbs-proj-name">{{ proj.name || proj.code }}</span>
            <span v-if="proj.code && proj.code !== proj.name" class="wbs-proj-code">{{ proj.code }}</span>
          </label>
          <button
            v-if="proj.children && proj.children.length"
            type="button"
            class="wbs-expand"
            @click="toggleExpand(proj.id)"
          >
            {{ expanded.has(proj.id) ? '收起' : `车号(${proj.children.length})` }}
          </button>
        </div>

        <div v-if="proj.children && proj.children.length && (expanded.has(proj.id) || keyword.trim())" class="wbs-cars">
          <label v-for="car in proj.children" :key="car.id" class="wbs-check wbs-car-check">
            <input
              type="checkbox"
              :checked="isCarSelected(car.id)"
              @change="toggleCar(proj, car)"
            />
            <span>{{ car.name || car.code }}</span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="selectedProjects.length || selectedCars.length" class="wbs-chosen">
      <div class="wbs-chosen-title">已选内容</div>
      <div class="wbs-chosen-body">
        <div v-if="selectedProjects.length" class="wbs-chosen-line">
          <span class="wbs-chosen-label">项目号：</span>
          <span v-for="p in selectedProjects" :key="'p' + p.id" class="wbs-chip">
            {{ p.name || p.code }}
            <button type="button" @click="removeProject(p.id)">×</button>
          </span>
        </div>
        <div v-if="selectedCars.length" class="wbs-chosen-line">
          <span class="wbs-chosen-label">车号：</span>
          <span v-for="c in selectedCars" :key="'c' + c.id" class="wbs-chip wbs-chip-car">
            {{ c.name || c.code }}
            <button type="button" @click="removeCar(c.id)">×</button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { wbsAPI } from '../api/index.js'

// 支持 v-model:projectIds / v-model:carIds（数组，多选）
const props = defineProps({
  projectIds: { type: Array, default: () => [] },
  carIds: { type: Array, default: () => [] },
  // 只允许选车号（例如按车号维度筛选）
  allowProjectOnly: { type: Boolean, default: true }
})
const emit = defineEmits(['update:projectIds', 'update:carIds'])

const tree = ref([])
const loading = ref(true)
const keyword = ref('')
const expanded = ref(new Set())

const selectedProjects = computed(() => {
  const ids = new Set(props.projectIds.map(Number))
  const out = []
  for (const p of tree.value) if (ids.has(Number(p.id))) out.push(p)
  return out
})

const selectedCars = computed(() => {
  const ids = new Set(props.carIds.map(Number))
  const out = []
  for (const p of tree.value) {
    for (const c of (p.children || [])) if (ids.has(Number(c.id))) out.push({ ...c, projectName: p.name })
  }
  return out
})

const visibleProjects = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return tree.value
  return tree.value
    .map(p => {
      const projHit = String(p.name || '').toLowerCase().includes(kw) || String(p.code || '').toLowerCase().includes(kw)
      const cars = (p.children || []).filter(c =>
        String(c.name || '').toLowerCase().includes(kw) || String(c.code || '').toLowerCase().includes(kw)
      )
      if (projHit) return { ...p, children: p.children || [] }
      if (cars.length) return { ...p, children: cars }
      return null
    })
    .filter(Boolean)
})

function isProjectSelected(id) {
  return props.projectIds.map(Number).includes(Number(id))
}

function isCarSelected(id) {
  return props.carIds.map(Number).includes(Number(id))
}

function toggleExpand(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// 勾选项目号时，默认把该项目下的车号一并勾选（便于「按项目整批下发」）
function toggleProject(proj) {
  const nextProjects = [...props.projectIds.map(Number)]
  const nextCars = [...props.carIds.map(Number)]
  const pid = Number(proj.id)
  const childIds = (proj.children || []).map(c => Number(c.id))

  if (nextProjects.includes(pid)) {
    emit('update:projectIds', nextProjects.filter(x => x !== pid))
    // 取消项目时同步移除其车号
    emit('update:carIds', nextCars.filter(x => !childIds.includes(x)))
  } else {
    nextProjects.push(pid)
    emit('update:projectIds', nextProjects)
    if (childIds.length) {
      for (const cid of childIds) if (!nextCars.includes(cid)) nextCars.push(cid)
      emit('update:carIds', nextCars)
    }
  }
}

function toggleCar(proj, car) {
  const nextCars = [...props.carIds.map(Number)]
  const cid = Number(car.id)
  if (nextCars.includes(cid)) {
    emit('update:carIds', nextCars.filter(x => x !== cid))
  } else {
    nextCars.push(cid)
    emit('update:carIds', nextCars)
    // 勾选车号时自动补上所属项目号
    const pid = Number(proj.id)
    if (!props.projectIds.map(Number).includes(pid)) {
      emit('update:projectIds', [...props.projectIds.map(Number), pid])
    }
  }
}

function removeProject(id) {
  toggleProject({ id, children: tree.value.find(p => Number(p.id) === Number(id))?.children || [] })
}

function removeCar(id) {
  emit('update:carIds', props.carIds.map(Number).filter(x => x !== Number(id)))
}

function clearAll() {
  emit('update:projectIds', [])
  emit('update:carIds', [])
}

onMounted(async () => {
  try {
    const data = await wbsAPI.tree()
    tree.value = data.tree || []
    // 默认展开首个项目，便于快速选择
    if (tree.value.length > 0) expanded.value = new Set([tree.value[0].id])
  } catch (e) {
    console.error('Failed to load WBS dictionary:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.wbs-selector { border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: #fff; }
.wbs-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.wbs-search {
  flex: 1; min-width: 160px; height: 34px; padding: 0 10px;
  border: 1px solid var(--border); border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box;
}
.wbs-search:focus { border-color: var(--primary); }
.wbs-count { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.wbs-clear { background: none; border: none; color: var(--primary); font-size: 12px; cursor: pointer; padding: 0; }
.wbs-clear:hover { text-decoration: underline; }

.wbs-tree { max-height: 280px; overflow-y: auto; }
.wbs-project { border-bottom: 1px solid #f5f7fa; padding: 6px 0; }
.wbs-project:last-child { border-bottom: none; }
.wbs-project-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.wbs-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
.wbs-check input { cursor: pointer; }
.wbs-proj-name { font-weight: 600; }
.wbs-proj-code { font-size: 11px; color: var(--text-caption); }
.wbs-expand {
  background: none; border: 1px solid var(--border); border-radius: 6px;
  padding: 2px 8px; font-size: 11px; color: var(--text-secondary); cursor: pointer; white-space: nowrap;
}
.wbs-expand:hover { border-color: var(--primary); color: var(--primary); }
.wbs-cars { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 8px 0 4px 24px; }
.wbs-car-check { font-size: 12px; color: var(--text-secondary); }

.wbs-empty { padding: 20px; text-align: center; font-size: 13px; color: var(--text-caption); }

.wbs-chosen { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
.wbs-chosen-title { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.wbs-chosen-body { display: flex; flex-direction: column; gap: 6px; }
.wbs-chosen-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.wbs-chosen-label { font-size: 12px; color: var(--text-secondary); }
.wbs-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  background: var(--primary-light, #e6f4ff); color: var(--primary);
  border-radius: 12px; font-size: 12px;
}
.wbs-chip-car { background: #f6ffed; color: #52c41a; }
.wbs-chip button { background: none; border: none; cursor: pointer; color: inherit; padding: 0; line-height: 1; }
</style>
