<template>
  <div class="cat-cascader">
    <div class="cat-row">
      <div class="cat-cell">
        <label class="cat-label">一级分类 <span class="req">*</span></label>
        <select v-model="localL1" class="cat-select" @change="onL1Change">
          <option :value="null" disabled>请选择一级分类</option>
          <option v-for="c in l1Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="cat-cell">
        <label class="cat-label">二级分类 <span class="req">*</span></label>
        <select v-model="localL2" class="cat-select" :disabled="!localL1" @change="onL2Change">
          <option :value="null" disabled>请选择二级分类</option>
          <option v-for="c in l2Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="cat-cell">
        <label class="cat-label">三级分类 <span class="req">*</span></label>
        <select v-model="localL3" class="cat-select" :disabled="!localL2" @change="onL3Change">
          <option :value="null" disabled>请选择三级分类</option>
          <option v-for="c in l3Options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>
    <div v-if="selectedL3" class="rule-hint">
      <span class="rule-label">该三级条目分值规则：</span>
      <span class="tag" :class="ruleClass(selectedL3.scoreRule)">{{ ruleLabel(selectedL3.scoreRule) }}</span>
      <span class="rule-score">{{ scoreHint(selectedL3) }}</span>
      <span v-if="selectedL3.scoreRule !== 'any'" class="rule-tip">
        审核时分数与数量相乘得总分。
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { dictionaryAPI } from '../api/index.js'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ l1: null, l2: null, l3: null }) }
})
const emit = defineEmits(['update:modelValue', 'change'])

const localL1 = ref(props.modelValue.l1 || null)
const localL2 = ref(props.modelValue.l2 || null)
const localL3 = ref(props.modelValue.l3 || null)

const l1Options = ref([])
const l2Options = ref([])
const l3Options = ref([])
const allCategories = ref([])

const tree = computed(() => {
  const map = {}
  for (const c of allCategories.value) {
    if (!map[c.parentId || 0]) map[c.parentId || 0] = []
    map[c.parentId || 0].push(c)
  }
  return map
})

const selectedL3 = computed(() => {
  if (!localL3.value) return null
  return allCategories.value.find(c => c.id === localL3.value) || null
})

function ruleLabel(rule) {
  return { fixed: '单值', range: '区间', any: '任意' }[rule] || ''
}
function ruleClass(rule) {
  return `rule-${rule || 'fixed'}`
}
function scoreHint(c) {
  if (!c) return ''
  if (c.scoreRule === 'fixed') {
    if (c.scoreValue === undefined || c.scoreValue === null) return '参考分值 —'
    return `参考分值 ≤ ${c.scoreValue}`
  }
  if (c.scoreRule === 'range') {
    if (c.scoreValue === undefined || c.scoreValue === null || c.scoreUpper === undefined || c.scoreUpper === null) return '参考分值 —'
    return `参考分值 ${c.scoreValue} - ${c.scoreUpper}`
  }
  return '任意分值'
}

async function loadAll() {
  try {
    const data = await dictionaryAPI.list()
    allCategories.value = data.categories || []
    l1Options.value = allCategories.value.filter(c => c.level === 1 && c.active)
  } catch (e) {
    console.error('Failed to load dictionary:', e)
  }
}

function onL1Change() {
  localL2.value = null
  localL3.value = null
  l2Options.value = allCategories.value.filter(c => c.level === 2 && c.parentId === localL1.value && c.active)
  l3Options.value = []
  emitChange()
}
function onL2Change() {
  localL3.value = null
  l3Options.value = allCategories.value.filter(c => c.level === 3 && c.parentId === localL2.value && c.active)
  emitChange()
}
function onL3Change() {
  emitChange()
}

function emitChange() {
  const payload = { l1: localL1.value, l2: localL2.value, l3: localL3.value, rule: selectedL3.value }
  emit('update:modelValue', payload)
  emit('change', payload)
}

watch(() => props.modelValue, (v) => {
  localL1.value = v?.l1 || null
  localL2.value = v?.l2 || null
  localL3.value = v?.l3 || null
  if (localL1.value) {
    l2Options.value = allCategories.value.filter(c => c.level === 2 && c.parentId === localL1.value && c.active)
  }
  if (localL2.value) {
    l3Options.value = allCategories.value.filter(c => c.level === 3 && c.parentId === localL2.value && c.active)
  }
}, { deep: true })

loadAll()
</script>

<style scoped>
.cat-cascader { display: flex; flex-direction: column; gap: 8px; }
.cat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.cat-cell { display: flex; flex-direction: column; gap: 4px; }
.cat-label { font-size: 13px; font-weight: 500; color: var(--text); }
.req { color: #ff4d4f; }
.cat-select {
  width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
  padding: 0 28px 0 10px; font-size: 13px; color: var(--text);
  background: #fff url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386909c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 10px center no-repeat;
  appearance: none; cursor: pointer; outline: none; box-sizing: border-box;
}
.cat-select:focus { border-color: var(--primary); }
.cat-select:disabled { background-color: #f5f5f5; cursor: not-allowed; }
.rule-hint { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); padding: 8px 12px; background: #fafbfc; border-radius: 6px; flex-wrap: wrap; }
.rule-label { font-weight: 500; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.rule-fixed { color: #fa8c16; background: #fff7e6; }
.rule-range { color: #1677ff; background: #e6f4ff; }
.rule-any { color: #8c8c8c; background: #f5f5f5; }
.rule-score { color: var(--text); font-weight: 500; }
.rule-tip { color: var(--text-caption); }
</style>
