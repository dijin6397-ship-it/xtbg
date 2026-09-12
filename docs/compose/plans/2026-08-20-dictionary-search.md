# Dictionary Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time search filtering to the dictionary management tree table, showing matching nodes plus their ancestor paths for context.

**Architecture:** Client-side filtering in the Vue component with a search input that filters the tree data. When search is active, display matching nodes with their full parent hierarchy. Non-matching branches collapse. Phase 2 adds advanced filter chips (level, active status, score rule).

**Tech Stack:** Vue 3, Composition API, existing dictionaryAPI, Element Plus-like custom components

## Global Constraints

- Use existing API endpoints: `/api/dictionary/tree` for loading, no new backend endpoints needed for phase 1
- Follow existing code style in A_Dictionary.vue (Composition API, scoped CSS)
- Maintain existing tree structure with `children` arrays
- Support Chinese UI text
- Keep changes minimal and focused

---

### Task 1: Add search input and state to A_Dictionary.vue

**Covers:** [S1]

**Files:**
- Modify: `src/views/admin/A_Dictionary.vue:1-50` (template toolbar area)
- Modify: `src/views/admin/A_Dictionary.vue:151-220` (script section for search state)

**Interfaces:**
- Consumes: `tree` ref (hierarchical tree from API), `flatList` computed
- Produces: `searchQuery` ref, `filteredTree` computed, `searchMatches` computed

- [ ] **Step 1: Write the failing test** - Add search input in toolbar

```vue
<!-- In template toolbar section, after the hint span -->
<div class="search-box">
  <input
    v-model="searchQuery"
    type="text"
    placeholder="搜索分类名称..."
    class="search-input"
    @input="onSearchInput"
  />
  <span v-if="searchQuery" class="search-clear" @click="clearSearch">×</span>
</div>
```

- [ ] **Step 2: Add search state and computed properties**

```javascript
// In script setup, after existing refs
const searchQuery = ref('')

const filteredTree = computed(() => {
  if (!searchQuery.value.trim()) return tree.value
  
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
  
  return tree.value.map(filterNode).filter(Boolean)
})

const searchMatches = computed(() => {
  if (!searchQuery.value.trim()) return 0
  const query = searchQuery.value.toLowerCase().trim()
  return flatList.value.filter(n => n.name.toLowerCase().includes(query)).length
})

function onSearchInput() {
  // Reactive, no action needed
}

function clearSearch() {
  searchQuery.value = ''
}
```

- [ ] **Step 3: Update template to use filteredTree**

```vue
<!-- Replace v-for="l1 in tree" with v-for="l1 in filteredTree" -->
<template v-for="l1 in filteredTree" :key="l1.id">
```

- [ ] **Step 4: Add search summary to page header**

```vue
<!-- In page-header, after summary span -->
<span v-if="searchQuery" class="search-summary">
  找到 {{ searchMatches }} 个匹配项
</span>
```

- [ ] **Step 5: Add search styles**

```css
/* Add to style section */
.search-box {
  position: relative;
  flex: 1;
  max-width: 360px;
}
.search-input {
  width: 100%;
  height: 36px;
  padding: 0 36px 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  box-sizing: border-box;
}
.search-input:focus { border-color: var(--primary); outline: none; }
.search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-caption);
  cursor: pointer;
  border-radius: 4px;
}
.search-clear:hover { background: var(--bg-secondary); color: var(--text); }
.search-summary { font-size: 12px; color: var(--primary); margin-left: 12px; }
```

- [ ] **Step 6: Test and commit**

```bash
# Run dev server and verify search works
npm run dev
# Expected: Search filters tree in real-time, shows matches + ancestors, clear button works
git add src/views/admin/A_Dictionary.vue
git commit -m "feat(dictionary): add real-time search filter for category tree"
```

---

### Task 2: Add advanced filter chips (Phase 2)

**Covers:** [S2]

**Files:**
- Modify: `src/views/admin/A_Dictionary.vue:1-60` (template toolbar)
- Modify: `src/views/admin/A_Dictionary.vue:151-220` (script section for filter state)

**Interfaces:**
- Consumes: `flatList` computed, `searchQuery` ref
- Produces: `activeFilters` reactive, `filteredTree` updated computed

- [ ] **Step 1: Add filter state**

```javascript
// In script setup
const activeFilters = reactive({
  level: null, // 1, 2, 3 or null
  activeOnly: true,
  scoreRule: null // 'fixed', 'range', 'any' or null
})
```

- [ ] **Step 2: Update filteredTree to include filters**

```javascript
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
  
  // Apply advanced filters
  function applyFilters(node) {
    // Level filter
    if (activeFilters.level && node.level !== activeFilters.level) return false
    // Active filter
    if (activeFilters.activeOnly && !node.active) return false
    // Score rule filter (only for level 3)
    if (activeFilters.scoreRule && node.level === 3 && node.scoreRule !== activeFilters.scoreRule) return false
    
    const children = node.children?.filter(applyFilters) || []
    return { ...node, children }
  }
  
  return nodes.map(applyFilters).filter(Boolean)
})
```

- [ ] **Step 3: Add filter chips UI in toolbar**

```vue
<!-- In toolbar, after search box -->
<div class="filter-chips" v-if="hasActiveFilters">
  <span class="filter-chip" v-if="activeFilters.level">
    级别: {{ levelLabel(activeFilters.level) }}
    <button @click="activeFilters.level = null">×</button>
  </span>
  <span class="filter-chip" v-if="!activeFilters.activeOnly">
    含禁用
    <button @click="activeFilters.activeOnly = true">×</button>
  </span>
  <span class="filter-chip" v-if="activeFilters.scoreRule">
    规则: {{ ruleLabel(activeFilters.scoreRule) }}
    <button @click="activeFilters.scoreRule = null">×</button>
  </span>
  <button class="btn btn-sm" @click="clearAllFilters">清除所有</button>
</div>

<!-- Dropdown triggers for each filter -->
<div class="filter-dropdowns">
  <select v-model="activeFilters.level" class="filter-select">
    <option value="">全级别</option>
    <option value="1">一级</option>
    <option value="2">二级</option>
    <option value="3">三级</option>
  </select>
  <select v-model="activeFilters.activeOnly" class="filter-select">
    <option value="true">仅启用</option>
    <option value="false">全部</option>
  </select>
  <select v-model="activeFilters.scoreRule" class="filter-select">
    <option value="">全规则</option>
    <option value="fixed">单值</option>
    <option value="range">区间</option>
    <option value="any">任意</option>
  </select>
</div>
```

- [ ] **Step 4: Add filter helper and styles**

```javascript
const hasActiveFilters = computed(() => 
  activeFilters.level || !activeFilters.activeOnly || activeFilters.scoreRule
)

function levelLabel(l) { return ['一级','二级','三级'][l-1] }
function ruleLabel(r) { return { fixed: '单值', range: '区间', any: '任意' }[r] }
function clearAllFilters() {
  activeFilters.level = null
  activeFilters.activeOnly = true
  activeFilters.scoreRule = null
}
```

```css
.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.filter-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--primary-light); color: var(--primary); border-radius: 12px; font-size: 12px; }
.filter-chip button { background: none; border: none; cursor: pointer; color: inherit; padding: 0; line-height: 1; }
.filter-dropdowns { display: flex; gap: 8px; margin-top: 8px; }
.filter-select { height: 32px; padding: 0 28px 0 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: #fff; appearance: none; cursor: pointer; }
```

- [ ] **Step 5: Test and commit**

```bash
npm run dev
# Expected: Filter dropdowns work, chips show active filters, clear works, combined with search
git add src/views/admin/A_Dictionary.vue
git commit -m "feat(dictionary): add advanced filter chips (level, active, score rule)"
```

---

### Task 3: Add backend search API (Optional enhancement for large datasets)

**Covers:** [S3]

**Files:**
- Modify: `server/routes/dictionary.js` (add search endpoint)
- Modify: `src/api/index.js` (add search API method)

**Interfaces:**
- Consumes: query params (q, level, active, scoreRule)
- Produces: filtered flat list or tree

- [ ] **Step 1: Add search endpoint to dictionary.js**

```javascript
// GET /api/dictionary/search - search categories with filters
router.get('/search', authMiddleware, (req, res) => {
  const { q, level, active, scoreRule } = req.query
  const db = getDB()
  
  let sql = 'SELECT * FROM dict_categories WHERE 1=1'
  const params = []
  
  if (q) { sql += ' AND name LIKE ?'; params.push(`%${q}%`) }
  if (level) { sql += ' AND level = ?'; params.push(Number(level)) }
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
  if (scoreRule) { sql += ' AND score_rule = ?'; params.push(scoreRule) }
  
  sql += ' ORDER BY level, sort_order, id'
  
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    out.push({
      id: row.id, level: row.level, parentId: row.parent_id,
      name: row.name, scoreRule: row.score_rule,
      scoreValue: row.score_value || 0, scoreUpper: row.score_upper || 0,
      sortOrder: row.sort_order || 0, active: row.active === 1
    })
  }
  stmt.free()
  
  // Build tree from flat results
  const byParent = {}
  for (const c of out) {
    const key = c.parentId || 0
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(c)
  }
  const build = (parentId) => (byParent[parentId] || []).map(c => ({ ...c, children: build(c.id) }))
  
  res.json({ tree: build(0), categories: out })
})
```

- [ ] **Step 2: Add search API method**

```javascript
// In dictionaryAPI object
search: (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/dictionary/search${qs ? '?' + qs : ''}`)
}
```

- [ ] **Step 3: Update A_Dictionary.vue to use backend search for large datasets (optional)**

> Note: For current dataset size, client-side filtering is sufficient. This task is optional and can be skipped if dataset < 1000 nodes.

- [ ] **Step 4: Test and commit**

```bash
git add server/routes/dictionary.js src/api/index.js
git commit -m "feat(dictionary): add backend search API for scalability"
```