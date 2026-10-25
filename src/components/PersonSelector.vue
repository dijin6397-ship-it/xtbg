<template>
  <div ref="rootRef" class="person-selector" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
    <!-- 输入框：聚焦后可直接输入中文 / 拼音 / 拼音简写进行模糊查询 -->
    <div class="selector-control" :class="{ 'is-open': isOpen }" @click="onControlClick">
      <span v-if="selectedPerson && !isOpen" class="selected-tag">
        <span class="tag-avatar">{{ (selectedPerson.name || '?').charAt(0) }}</span>
        <span class="tag-name">{{ selectedPerson.name }}</span>
      </span>
      <input
        ref="inputRef"
        v-model="keyword"
        class="selector-input"
        type="text"
        :placeholder="selectedPerson && !isOpen ? '' : placeholder"
        :disabled="disabled"
        autocomplete="off"
        @focus="onFocus"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="close"
        @keydown.tab="close"
      />
      <span
        v-if="clearable && selectedPerson && !disabled"
        class="clear-btn"
        title="清空"
        @click.stop="clearSelection"
      >×</span>
      <svg class="arrow-icon" :class="{ rotate: isOpen }" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>

    <!-- 下拉面板 -->
    <div v-if="isOpen" class="selector-dropdown" @mousedown.prevent>
      <div class="dropdown-hint">
        可输入 <b>中文名</b>、<b>全拼</b> 或 <b>拼音简写</b>（如：zhangming / zm / zhm）
      </div>
      <div v-if="searchingPinyinWhileLoading" class="loading-tip">拼音检索加载中，请稍候…</div>
      <div ref="listRef" class="options-list">
        <div
          v-for="(option, index) in visibleOptions"
          :key="option.id"
          class="option-item"
          :class="{ active: index === activeIndex, selected: isSelected(option) }"
          @mouseenter="activeIndex = index"
          @click="selectOption(option)"
        >
          <span class="option-avatar">{{ (option.name || option.username || '?').charAt(0) }}</span>
          <span class="option-main">
            <span class="option-name">{{ option.name || option.username }}</span>
            <span v-if="pinyinOf(option)" class="option-pinyin">{{ pinyinOf(option) }}</span>
          </span>
          <span v-if="departmentOf(option)" class="option-dept">{{ departmentOf(option) }}</span>
          <svg v-if="isSelected(option)" class="check-icon" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <div v-if="!visibleOptions.length" class="empty-tip">
          未找到匹配人员，请尝试其他关键字
        </div>
        <div v-else-if="filteredOptions.length > visibleOptions.length" class="more-tip">
          共 {{ filteredOptions.length }} 位匹配人员，请继续输入以缩小范围
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  filterPersons,
  getPinyin,
  getPinyinInitials,
  ensurePinyinReady,
  isPinyinReady
} from '../utils/pinyin.js'

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择人员' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  // 最多渲染多少条，避免人员基数大时卡顿
  maxRender: { type: Number, default: 50 }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const inputRef = ref(null)
const listRef = ref(null)
const isOpen = ref(false)
const keyword = ref('')
const activeIndex = ref(0)
// 拼音词典按需加载：就绪前仍可用中文名搜索，就绪后自动补上拼音检索
const pinyinReady = ref(isPinyinReady())

const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')

const selectedPerson = computed(() => {
  if (!hasValue.value) return null
  return props.options.find(u => String(u.id) === String(props.modelValue)) || null
})

// 模糊查询：中文名 / 全拼 / 拼音简写 / 账号 / 工号 / 部门
const filteredOptions = computed(() => {
  // 显式依赖拼音就绪状态：词典异步加载完成后自动重新过滤
  pinyinReady.value
  return filterPersons(props.options, keyword.value)
})

// 每个候选人的拼音提示（如「zhangming · zm」），词典未就绪时为空
const pinyinLabels = computed(() => {
  const map = new Map()
  if (!pinyinReady.value) return map
  for (const option of props.options) {
    const full = getPinyin(option.name)
    if (!full) continue
    const { strict } = getPinyinInitials(option.name)
    map.set(option.id, strict ? `${full} · ${strict}` : full)
  }
  return map
})

const visibleOptions = computed(() => filteredOptions.value.slice(0, props.maxRender))

// 选中值被外部清空或重置时同步
watch(() => props.modelValue, () => {
  if (!isOpen.value) keyword.value = ''
})

// 搜索结果变化时重置高亮项，避免索引越界
watch(visibleOptions, () => {
  activeIndex.value = 0
})

function onControlClick() {
  if (props.disabled) return
  if (!isOpen.value) open()
}

function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  keyword.value = ''
  // 打开时定位到已选项
  const idx = visibleOptions.value.findIndex(o => isSelected(o))
  activeIndex.value = idx > -1 ? idx : 0
  nextTick(() => inputRef.value && inputRef.value.focus())
}

function onFocus() {
  if (!isOpen.value) open()
}

function close() {
  isOpen.value = false
  keyword.value = ''
}

function isSelected(option) {
  return hasValue.value && String(option.id) === String(props.modelValue)
}

function selectOption(option) {
  emit('update:modelValue', option.id)
  emit('change', option)
  close()
}

function clearSelection() {
  emit('update:modelValue', null)
  emit('change', null)
}

function moveActive(step) {
  if (!isOpen.value) {
    open()
    return
  }
  const total = visibleOptions.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + step + total) % total
  scrollActiveIntoView()
}

function onEnter() {
  if (!isOpen.value) {
    open()
    return
  }
  const option = visibleOptions.value[activeIndex.value]
  if (option) selectOption(option)
}

function scrollActiveIntoView() {
  nextTick(() => {
    const list = listRef.value
    if (!list) return
    const el = list.children[activeIndex.value]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  })
}

// 列表项展示：姓名 + 全拼 + 首字母简写
function pinyinOf(option) {
  return pinyinLabels.value.get(option.id) || ''
}

function departmentOf(option) {
  return option.department || option.dept || ''
}

// 词典尚在加载且用户输入的是拼音时，给出「加载中」提示，避免误以为搜不到人
const searchingPinyinWhileLoading = computed(() => {
  if (pinyinReady.value) return false
  return /^[a-zA-Z]+$/.test(keyword.value.trim())
})

onMounted(async () => {
  if (pinyinReady.value) return
  pinyinReady.value = await ensurePinyinReady()
})

// 点击组件外部关闭
function onDocumentClick(event) {
  if (!isOpen.value) return
  if (rootRef.value && !rootRef.value.contains(event.target)) close()
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  if (pinyinReady.value) return
  pinyinReady.value = await ensurePinyinReady()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

defineExpose({ open, close, focus: () => inputRef.value && inputRef.value.focus() })
</script>

<style scoped>
.person-selector {
  position: relative;
  width: 100%;
}

.selector-control {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 5px 10px;
  background: #fff;
  border: 1px solid var(--border, #e5e6eb);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.selector-control:hover {
  border-color: var(--primary, #1677ff);
}

.selector-control.is-open {
  border-color: var(--primary, #1677ff);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.is-disabled .selector-control {
  background: #f7f8fa;
  cursor: not-allowed;
  border-color: var(--border, #e5e6eb);
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  max-width: 100%;
}

.tag-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #722ed1;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tag-name {
  font-size: 13px;
  color: var(--text, #1d2129);
  white-space: nowrap;
}

.selector-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text, #1d2129);
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

.selector-control.is-open .selector-input {
  cursor: text;
}

.selector-input::placeholder {
  color: var(--text-caption, #c9cdd4);
}

.clear-btn {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  line-height: 14px;
  text-align: center;
  border-radius: 50%;
  font-size: 13px;
  color: var(--text-secondary, #86909c);
  background: #f2f3f5;
}

.clear-btn:hover {
  color: #fff;
  background: var(--text-secondary, #86909c);
}

.arrow-icon {
  flex-shrink: 0;
  color: var(--text-secondary, #86909c);
  transition: transform 0.2s;
}

.arrow-icon.rotate {
  transform: rotate(180deg);
}

.selector-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1050;
  background: #fff;
  border: 1px solid var(--border, #e5e6eb);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.dropdown-hint {
  padding: 7px 10px;
  font-size: 11px;
  color: var(--text-secondary, #86909c);
  background: #f7f8fa;
  border-bottom: 1px solid var(--border, #e5e6eb);
  line-height: 1.5;
}

.dropdown-hint b {
  color: var(--primary, #1677ff);
  font-weight: 600;
}

.loading-tip {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--warning, #fa8c16);
  background: #fffbe6;
  border-bottom: 1px solid var(--border, #e5e6eb);
}

.options-list {
  max-height: 240px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid #f7f8fa;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item.active {
  background: var(--primary-light, #e6f4ff);
}

.option-item.selected .option-name {
  color: var(--primary, #1677ff);
  font-weight: 600;
}

.option-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #722ed1;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.option-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.option-name {
  font-size: 13px;
  color: var(--text, #1d2129);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-pinyin {
  font-size: 11px;
  color: var(--text-secondary, #86909c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-dept {
  flex-shrink: 0;
  max-width: 40%;
  font-size: 11px;
  color: var(--text-secondary, #86909c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  flex-shrink: 0;
  color: var(--primary, #1677ff);
}

.empty-tip,
.more-tip {
  padding: 14px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #86909c);
}

.more-tip {
  padding: 8px 10px;
  border-top: 1px solid #f7f8fa;
}
</style>
