<template>
  <div class="dict-page">
    <div class="page-header">
      <h2>分类字典管理</h2>
      <span class="summary">共 {{ flatList.length }} 条分类</span>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary" @click="openCreateDialog()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新增分类
      </button>
      <span class="hint">维护一/二/三级分类，并配置每个三级条目的参考分值规则</span>
    </div>

    <div class="search-toolbar">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索分类名称..."
          class="search-input"
        />
        <span v-if="searchQuery" class="search-clear" @click="clearSearch">×</span>
      </div>
      <span v-if="searchQuery" class="search-summary">
        找到 {{ searchMatches }} 个匹配项
      </span>
    </div>

    <div class="filter-toolbar">
      <div class="filter-dropdowns">
        <select v-model="activeFilters.level" class="filter-select" @change="onFilterChange">
          <option value="">全级别</option>
          <option value="1">一级</option>
          <option value="2">二级</option>
          <option value="3">三级</option>
        </select>
        <select v-model="activeFilters.activeOnly" class="filter-select" @change="onFilterChange">
          <option :value="true">仅启用</option>
          <option :value="false">全部</option>
        </select>
        <select v-model="activeFilters.scoreRule" class="filter-select" @change="onFilterChange">
          <option value="">全规则</option>
          <option value="fixed">单值</option>
          <option value="range">区间</option>
          <option value="any">任意</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="doQuery">查询</button>
        <button class="btn btn-sm" @click="showAllTree">显示全部</button>
      </div>
      <div v-if="hasActiveFilters || searchQuery" class="filter-chips">
        <span class="filter-chip" v-if="activeFilters.level">
          级别: {{ levelLabel(activeFilters.level) }}
          <button @click="clearFilter('level')">×</button>
        </span>
        <span class="filter-chip" v-if="!activeFilters.activeOnly">
          含禁用
          <button @click="clearFilter('activeOnly')">×</button>
        </span>
        <span class="filter-chip" v-if="activeFilters.scoreRule">
          规则: {{ ruleLabel(activeFilters.scoreRule) }}
          <button @click="clearFilter('scoreRule')">×</button>
        </span>
        <span class="filter-chip" v-if="searchQuery" style="background: var(--primary-light); color: var(--primary);">
          搜索: {{ searchQuery }}
          <button @click="clearSearch">×</button>
        </span>
        <button class="btn btn-sm" @click="clearAllFilters">清除所有</button>
      </div>
    </div>

    <div class="card table-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="filteredTree.length === 0" class="empty-state">
        <p>暂无数据字典</p>
      </div>
      <div v-else class="tree-view-panel">
        <TreeTableRows :nodes="filteredTree" :level="1" @edit="openEditDialog" @delete="confirmDelete" />
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="showDialog = false">
      <div class="dialog">
        <h3>{{ editing ? '编辑分类' : '新增分类' }}</h3>
        <div class="form-group">
          <label class="form-label">一级分类名称 <span class="req">*</span></label>
          <input v-model="form.level1Name" class="form-input" placeholder="请输入一级分类名称，没有则填“无”" />
        </div>
        <div class="form-group">
          <label class="form-label">二级分类名称 <span class="req">*</span></label>
          <input v-model="form.level2Name" class="form-input" placeholder="请输入二级分类名称，没有则填“无”" />
        </div>
        <div class="form-group">
          <label class="form-label">三级分类名称 <span class="req">*</span></label>
          <input v-model="form.level3Name" class="form-input" placeholder="请输入三级分类名称，没有则填“无”" />
        </div>
        <div class="form-group">
          <label class="form-label">分值规则 <span class="req">*</span></label>
          <select v-model="form.scoreRule" class="form-input">
            <option value="fixed">单值（不得超过该分值）</option>
            <option value="range">区间（必须在分值之间）</option>
            <option value="any">任意分值</option>
          </select>
        </div>
        <div class="form-group" v-if="form.scoreRule === 'fixed'">
          <label class="form-label">固定分值 <span class="req">*</span></label>
          <input v-model.number="form.scoreValue" type="number" min="0" step="0.5" class="form-input" />
        </div>
        <div class="form-row" v-if="form.scoreRule === 'range'">
          <div class="form-group">
            <label class="form-label">分值下限 <span class="req">*</span></label>
            <input v-model.number="form.scoreValue" type="number" step="0.5" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">分值上限 <span class="req">*</span></label>
            <input v-model.number="form.scoreUpper" type="number" step="0.5" class="form-input" />
          </div>
        </div>
        <div v-if="form.scoreRule === 'any'" class="hint-line">
          任意分值，审核时不受限制（一般使用于一次性临时事项）
        </div>
        <div class="form-group">
          <label class="form-label">启用</label>
          <label class="switch">
            <input type="checkbox" v-model="form.active" />
            <span></span>
          </label>
        </div>
        <div v-if="formError" class="error-msg">{{ formError }}</div>
        <div class="dialog-actions">
          <button class="btn" @click="showDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { dictionaryAPI } from '../../api/index.js'

// 递归树形表格行组件
const TreeTableRows = {
  name: 'TreeTableRows',
  props: {
    nodes: { type: Array, required: true },
    level: { type: Number, default: 1 }
  },
  emits: ['edit', 'delete'],
  setup(props, { emit }) {
    function toggleExpand(node) {
      if (!node.id) return
      const newExpanded = new Set(treeExpanded.value)
      if (newExpanded.has(node.id)) {
        newExpanded.delete(node.id)
      } else {
        newExpanded.add(node.id)
      }
      treeExpanded.value = newExpanded
    }

    function isExpanded(node) {
      return node.id && treeExpanded.value.has(node.id)
    }

    function hasChildren(node) {
      return node.children && node.children.length > 0
    }

    return {
      toggleExpand,
      isExpanded,
      hasChildren,
      ruleLabel: (rule) => ({ fixed: '单值', range: '区间', any: '任意' })[rule] || '',
      ruleClass: (rule) => `rule-${rule || 'fixed'}`,
      scoreHint: (c) => {
        if (c.level !== 3) return '—'
        if (c.scoreRule === 'fixed') {
          if (c.scoreValue === undefined || c.scoreValue === null || c.scoreValue === '') return '—'
          return `≤ ${c.scoreValue}`
        }
        if (c.scoreRule === 'range') {
          if (c.scoreValue === undefined || c.scoreValue === null || c.scoreValue === '' || c.scoreUpper === undefined || c.scoreUpper === null || c.scoreUpper === '') return '—'
          return `${c.scoreValue} - ${c.scoreUpper}`
        }
        return '任意'
      },
      levelLabel: (l) => ['一级', '二级', '三级'][Number(l) - 1] || '',
      getParentName: (node) => {
        return node.parentName || '—'
      },
      onEdit: (node) => emit('edit', node),
      onDelete: (node) => emit('delete', node)
    }
  },
  template: `
    <div class="tree-list">
      <div v-for="node in nodes" :key="node.id" class="tree-node-wrapper">
        <div :class="['tree-card', 'tree-card-l' + node.level, { inactive: !node.active }]">
          <div class="tree-card-main">
            <button v-if="hasChildren(node)" class="expand-toggle" @click="toggleExpand(node)" aria-label="展开/折叠">
              <span class="expand-icon">{{ isExpanded(node) ? '−' : '+' }}</span>
            </button>
            <span v-else class="expand-toggle leaf-toggle">·</span>
            <div class="tree-card-info">
              <span class="tag" :class="'tag-l' + node.level">{{ levelLabel(node.level) }}</span>
              <span class="node-name">{{ node.name }}</span>
              <span v-if="node.level === 3" class="score-line">
                <span class="tag" :class="ruleClass(node.scoreRule)">{{ ruleLabel(node.scoreRule) }}</span>
                <span class="score-value">{{ scoreHint(node) }}</span>
              </span>
              <span class="status-dot" :class="{ active: node.active }"></span>
              <span class="status-text">{{ node.active ? '启用' : '禁用' }}</span>
            </div>
          </div>
          <div class="tree-card-actions">
            <button class="btn btn-sm" @click="onEdit(node)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="onDelete(node)">删除</button>
          </div>
        </div>
        <div v-if="hasChildren(node) && isExpanded(node)" class="tree-children tree-children-l" :class="'tree-children-l' + node.level">
          <TreeTableRows :nodes="node.children" :level="node.level + 1" @edit="onEdit" @delete="onDelete" />
        </div>
      </div>
    </div>
  `
}

// Shared expanded state for all tree nodes
const treeExpanded = ref(new Set())

function collectAllNodeIds(nodes) {
  const ids = new Set()
  function walk(items) {
    for (const n of items) {
      if (n.id) ids.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return ids
}

const tree = ref([])
const loading = ref(true)
const showDialog = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')
const searchQuery = ref('')
const activeFilters = reactive({
  level: '',
  activeOnly: true,
  scoreRule: ''
})

const form = reactive({
  level1Name: '',
  level2Name: '',
  level3Name: '',
  scoreRule: 'fixed',
  scoreValue: 0,
  scoreUpper: 0,
  active: true
})

const flatList = computed(() => {
  const out = []
  const walk = (nodes) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(tree.value)
  return out
})

const filteredTree = computed(() => {
  let nodes = tree.value

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    function filterNode(node) {
      const matches = node.name.toLowerCase().includes(query)
      const children = node.children?.filter(filterNode) || []
      const hasMatchingChildren = children.length > 0
      if (matches || hasMatchingChildren) {
        return { ...node, children: hasMatchingChildren ? children : [] }
      }
      return null
    }
    nodes = nodes.map(filterNode).filter(Boolean)
  }

  // Apply advanced filters (level, active, scoreRule)
  // We need to keep parent nodes if they have matching children
  function applyFilters(node) {
    // Check if current node matches filters
    let matches = true
    // Level filter
    if (activeFilters.level && node.level !== Number(activeFilters.level)) matches = false
    // Active filter
    if (activeFilters.activeOnly && !node.active) matches = false
    // Score rule filter (only for level 3)
    if (activeFilters.scoreRule && node.level === 3 && node.scoreRule !== activeFilters.scoreRule) matches = false

    // Recursively filter children
    const children = node.children?.filter(applyFilters) || []
    const hasMatchingChildren = children.length > 0

    // Keep node if it matches OR has matching children
    if (matches || hasMatchingChildren) {
      return { ...node, children: hasMatchingChildren ? children : [] }
    }
    return null
  }

  return nodes.map(applyFilters).filter(Boolean)
})

function clearSearch() {
  searchQuery.value = ''
}

const searchMatches = computed(() => {
  if (!searchQuery.value.trim()) return 0
  const query = searchQuery.value.toLowerCase().trim()
  return flatList.value.filter(n => n.name.toLowerCase().includes(query)).length
})

const hasActiveFilters = computed(() =>
  activeFilters.level || !activeFilters.activeOnly || activeFilters.scoreRule
)

function levelLabel(l) {
  return ['一级', '二级', '三级'][Number(l) - 1] || ''
}

function onFilterChange() {
  // Reactive, triggers filteredTree recomputation
}

function clearFilter(key) {
  if (key === 'level') activeFilters.level = ''
  else if (key === 'activeOnly') activeFilters.activeOnly = false
  else if (key === 'scoreRule') activeFilters.scoreRule = ''
}

function clearAllFilters() {
  activeFilters.level = ''
  activeFilters.activeOnly = true
  activeFilters.scoreRule = ''
  searchQuery.value = ''
}

function doQuery() {
  // 执行查询时保持当前展开状态（或根据需要展开所有）
  console.log('执行查询，当前筛选条件:', {
    level: activeFilters.level,
    activeOnly: activeFilters.activeOnly,
    scoreRule: activeFilters.scoreRule,
    searchQuery: searchQuery.value
  })
  // 显示查询结果：自动展开所有有子节点的节点，确保层级可见
  treeExpanded.value = collectAllNodeIds(filteredTree.value)
}

function showAllTree() {
  // 清除所有筛选条件，显示完整的树形结构，并全部展开
  activeFilters.level = ''
  activeFilters.activeOnly = false
  activeFilters.scoreRule = ''
  searchQuery.value = ''
  treeExpanded.value = collectAllNodeIds(tree.value)
}

const parentOptions = computed(() => {
  if (form.level === 2) {
    return flatList.value.filter(n => n.level === 1).map(n => ({ id: n.id, label: n.name }))
  }
  if (form.level === 3) {
    return flatList.value.filter(n => n.level === 2).map(n => ({ id: n.id, label: `${n.parentId ? treeLookup(n.parentId)?.name : ''} / ${n.name}` }))
  }
  return []
})

function treeLookup(id) {
  return flatList.value.find(n => n.id === id)
}

function ruleLabel(rule) {
  return { fixed: '单值', range: '区间', any: '任意' }[rule] || rule
}
function ruleClass(rule) {
  return `rule-${rule || 'fixed'}`
}
function scoreHint(c) {
  if (c.level !== 3) return '—'
  if (c.scoreRule === 'fixed') {
    if (c.scoreValue === undefined || c.scoreValue === null || c.scoreValue === '') return '—'
    return `≤ ${c.scoreValue}`
  }
  if (c.scoreRule === 'range') {
    if (c.scoreValue === undefined || c.scoreValue === null || c.scoreValue === '' || c.scoreUpper === undefined || c.scoreUpper === null || c.scoreUpper === '') return '—'
    return `${c.scoreValue} - ${c.scoreUpper}`
  }
  return '任意'
}

async function loadTree() {
  loading.value = true
  try {
    const data = await dictionaryAPI.tree()
    console.log('[Dictionary] API response:', data)
    // 为每个节点添加 parentName 以便显示
    function addParentNames(nodes, parentName = '—') {
      for (const n of nodes) {
        n.parentName = parentName
        if (n.children?.length) {
          addParentNames(n.children, n.name)
        }
      }
    }
    const loadedTree = data.tree || []
    console.log('[Dictionary] Loaded tree:', loadedTree)
    addParentNames(loadedTree)
    tree.value = loadedTree
    console.log('[Dictionary] tree.value set, flatList length:', flatList.value.length)
    // 页面初始加载时自动展开所有节点，确保层级可见
    treeExpanded.value = collectAllNodeIds(loadedTree)
  } catch (e) {
    console.error('Failed to load dictionary:', e)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editing.value = null
  form.level1Name = ''
  form.level2Name = ''
  form.level3Name = ''
  form.scoreRule = 'fixed'
  form.scoreValue = 0
  form.scoreUpper = 0
  form.active = true
  formError.value = ''
  showDialog.value = true
}

function openEditDialog(node) {
  editing.value = node
  // 解析节点的层级名称
  if (node.level === 1) {
    form.level1Name = node.name
    form.level2Name = ''
    form.level3Name = ''
  } else if (node.level === 2) {
    // 需要找到父节点
    const parent = flatList.value.find(n => n.id === node.parentId)
    form.level1Name = parent?.name || ''
    form.level2Name = node.name
    form.level3Name = ''
  } else if (node.level === 3) {
    const parent = flatList.value.find(n => n.id === node.parentId)
    const grandParent = parent ? flatList.value.find(n => n.id === parent.parentId) : null
    form.level1Name = grandParent?.name || ''
    form.level2Name = parent?.name || ''
    form.level3Name = node.name
  }
  form.scoreRule = node.scoreRule || 'fixed'
  form.scoreValue = node.scoreValue || 0
  form.scoreUpper = node.scoreUpper || 0
  form.active = node.active !== false
  formError.value = ''
  showDialog.value = true
}

async function handleSave() {
  formError.value = ''
  
  // 验证必填字段
  if (!form.level1Name.trim()) { formError.value = '请填写一级分类名称'; return }
  if (!form.level2Name.trim()) { formError.value = '请填写二级分类名称'; return }
  if (!form.level3Name.trim()) { formError.value = '请填写三级分类名称'; return }
  
  // 验证分值规则
  if (form.scoreRule === 'fixed' && (form.scoreValue < 0 || isNaN(form.scoreValue))) {
    formError.value = '请填写有效的固定分值'; return
  }
  if (form.scoreRule === 'range') {
    if (isNaN(form.scoreValue) || isNaN(form.scoreUpper) || form.scoreValue > form.scoreUpper) {
      formError.value = '分值区间无效（下限必须 ≤ 上限）'; return
    }
  }
  
  saving.value = true
  try {
    // 确定要创建/编辑的层级
    let targetLevel = 1
    let targetName = form.level1Name.trim()
    let targetParentId = null
    
    if (form.level3Name.trim() && form.level3Name.trim() !== '无') {
      targetLevel = 3
      targetName = form.level3Name.trim()
      // 找到二级分类的ID作为父级
      const parent = flatList.value.find(n => n.level === 2 && n.name === form.level2Name.trim())
      targetParentId = parent?.id || null
    } else if (form.level2Name.trim() && form.level2Name.trim() !== '无') {
      targetLevel = 2
      targetName = form.level2Name.trim()
      // 找到一级分类的ID作为父级
      const parent = flatList.value.find(n => n.level === 1 && n.name === form.level1Name.trim())
      targetParentId = parent?.id || null
    } else {
      targetLevel = 1
      targetName = form.level1Name.trim()
      targetParentId = null
    }
    
    const payload = {
      level: targetLevel,
      parentId: targetParentId,
      name: targetName,
      scoreRule: form.scoreRule,
      scoreValue: form.scoreValue,
      scoreUpper: form.scoreUpper,
      active: form.active
    }
    
    if (editing.value) {
      await dictionaryAPI.update(editing.value.id, payload)
    } else {
      await dictionaryAPI.create(payload)
    }
    showDialog.value = false
    await loadTree()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function confirmDelete(node) {
  if (!confirm(`确定要删除「${node.name}」？${node.level !== 3 ? '其下级分类也会被删除。' : ''}`)) return
  try {
    await dictionaryAPI.remove(node.id)
    await loadTree()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(loadTree)
</script>

<style scoped>
.dict-page { display: flex; flex-direction: column; gap: 20px; }
.page-header { display: flex; align-items: baseline; gap: 12px; background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%); color: #fff; padding: 16px 16px 20px; border-radius: var(--radius); margin-bottom: 8px; }
.page-header h2 { font-size: 20px; font-weight: 600; color: #fff; margin: 0; }
.summary { font-size: 13px; color: rgba(255,255,255,0.85); }

.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar .hint { font-size: 12px; color: var(--text-caption); }

.search-toolbar { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.search-box { position: relative; flex: 1; max-width: 360px; }
.search-input {
  width: 100%; height: 36px; padding: 0 36px 0 12px;
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text); box-sizing: border-box; background: #fff;
}
.search-input:focus { border-color: var(--primary); outline: none; }
.search-clear {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-caption); cursor: pointer; border-radius: 4px;
}
.search-clear:hover { background: var(--bg-secondary); color: var(--text); }
.search-summary { font-size: 12px; color: var(--primary); margin-left: 12px; }

.filter-toolbar { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.filter-dropdowns { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-select {
  height: 32px; padding: 0 28px 0 8px;
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 12px; color: var(--text);
  background: #fff; appearance: none; cursor: pointer;
}
.filter-select:focus { border-color: var(--primary); outline: none; }
.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--primary-light); color: var(--primary); border-radius: 12px; font-size: 12px; }
.filter-chip button { background: none; border: none; cursor: pointer; color: inherit; padding: 0; line-height: 1; }

.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  text-align: left; padding: 12px 14px; color: var(--text-secondary);
  font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; background: #fafbfc;
}
.data-table td { padding: 10px 14px; border-bottom: 1px solid #f5f7fa; color: var(--text); }
.data-table tbody tr:hover { background: #fafbfc; }
.row-l1 { background: #fafbfc; }
.row-l2 td { background: #fff; }
.row-l3 td { background: #fcfdff; }
.indent { color: var(--text-caption); margin-right: 4px; }
.cell-name { font-weight: 500; }

/* 展开/折叠按钮 */
.expand-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border: 1px solid var(--border); border-radius: 4px;
  background: #fff; color: var(--text-secondary);
  cursor: pointer; transition: all 0.2s;
}
.expand-btn:hover { background: var(--bg-secondary); color: var(--primary); border-color: var(--primary); }
.expand-btn svg { transition: transform 0.2s; }
.expand-btn.expanded svg { transform: rotate(90deg); }
.expand-placeholder { width: 24px; display: inline-block; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.tag-l1 { color: #1677ff; background: #e6f4ff; }
.tag-l2 { color: #fa8c16; background: #fff7e6; }
.tag-l3 { color: #722ed1; background: #f9f0ff; }
.rule-fixed { color: #fa8c16; background: #fff7e6; }
.rule-range { color: #1677ff; background: #e6f4ff; }
.rule-any { color: #8c8c8c; background: #f5f5f5; }

.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ccc; margin-right: 6px; vertical-align: middle; }
.status-dot.active { background: #52c41a; }

.action-btns { display: flex; gap: 6px; flex-wrap: wrap; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text);
  transition: all 0.2s;
}
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-primary:hover:not(:disabled) { background: #4096ff; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff2f0; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.form-input {
  width: 100%; height: 40px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 12px; font-size: 14px; color: var(--text); outline: none; box-sizing: border-box; background: #fff;
}
.form-input:focus { border-color: var(--primary); }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
.req { color: #ff4d4f; }
.switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch span { position: absolute; cursor: pointer; inset: 0; background: #bfbfbf; border-radius: 22px; transition: 0.2s; }
.switch span::before { position: absolute; content: ''; height: 18px; width: 18px; left: 2px; top: 2px; background: white; border-radius: 50%; transition: 0.2s; }
.switch input:checked + span { background: var(--primary); }
.switch input:checked + span::before { transform: translateX(18px); }
.hint-line { font-size: 12px; color: var(--text-caption); padding: 8px 12px; background: #fafbfc; border-radius: 6px; }
.error-msg { color: #ff4d4f; font-size: 13px; margin-bottom: 12px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.dialog {
  background: #fff; border-radius: var(--radius); padding: 28px;
  width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
}
.dialog h3 { margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: var(--text); }

.loading-state, .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); font-size: 14px; }

/* 层级卡片树形视图 */
.tree-view-panel { padding: 16px; }
.tree-list { display: flex; flex-direction: column; gap: 8px; }
.tree-node-wrapper { display: flex; flex-direction: column; }

.tree-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  border-left-width: 4px;
  background: #fff;
  transition: all 0.2s;
}
.tree-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.tree-card.inactive { opacity: 0.65; }

.tree-card-l1 { border-left-color: #1677ff; background: linear-gradient(90deg, #e6f4ff 0%, #ffffff 40px); }
.tree-card-l2 { border-left-color: #fa8c16; background: linear-gradient(90deg, #fff7e6 0%, #ffffff 40px); }
.tree-card-l3 { border-left-color: #52c41a; background: linear-gradient(90deg, #f6ffed 0%, #ffffff 40px); }

.tree-card-main { display: flex; align-items: center; gap: 12px; flex: 1; }

.expand-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border: 1px solid var(--border); border-radius: 4px;
  background: #fff; color: var(--text);
  cursor: pointer; font-size: 16px; font-weight: 600; line-height: 1;
  transition: all 0.2s; flex-shrink: 0;
}
.expand-toggle:hover { border-color: var(--primary); color: var(--primary); }
.leaf-toggle { border-color: transparent; background: transparent; cursor: default; color: var(--text-caption); font-size: 20px; }

.tree-card-info {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.node-name { font-size: 14px; font-weight: 600; color: var(--text); }
.score-line { display: inline-flex; align-items: center; gap: 6px; }
.score-value { font-size: 13px; color: var(--text-secondary); }
.status-text { font-size: 13px; color: var(--text-secondary); }

.tree-card-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.tree-children {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 8px; padding-left: 28px;
  border-left: 1px dashed var(--border);
  margin-left: 11px;
}
.tree-children-l1 { border-left-color: #1677ff33; }
.tree-children-l2 { border-left-color: #fa8c1633; }
.tree-children-l3 { border-left-color: #52c41a33; }
</style>