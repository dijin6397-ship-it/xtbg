import { reactive, computed } from 'vue'
import { authAPI } from '../api/index.js'

export const authStore = reactive({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || '',
  loading: false
})

export const isLoggedIn = computed(() => !!authStore.token)
export const currentUser = computed(() => authStore.user)
export const isAdmin = computed(() => authStore.user?.role === 'admin')
export const isLeader = computed(() => authStore.user?.role === 'leader')
export const isSupervisor = computed(() => ['supervisor_tech', 'supervisor_quality'].includes(authStore.user?.role))
export const isSupervisorTech = computed(() => authStore.user?.role === 'supervisor_tech')
export const isSupervisorQuality = computed(() => authStore.user?.role === 'supervisor_quality')
export const isStaff = computed(() => ['staff_tech', 'staff_quality'].includes(authStore.user?.role))
export const isStaffTech = computed(() => authStore.user?.role === 'staff_tech')
export const isStaffQuality = computed(() => authStore.user?.role === 'staff_quality')

export const canApproveFinal = computed(() => authStore.user?.role === 'leader' || authStore.user?.role === 'admin')
export const canReviewOutput = computed(() => ['supervisor_tech', 'supervisor_quality', 'admin'].includes(authStore.user?.role))
export const canSubmitOutput = computed(() => ['staff_tech', 'staff_quality'].includes(authStore.user?.role))
export const canCreateTask = computed(() => true)
export const canCreateDailyTask = computed(() => true)

export async function login(username, password) {
  authStore.loading = true
  try {
    const data = await authAPI.login(username, password)
    authStore.token = data.token
    authStore.user = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data.user
  } finally {
    authStore.loading = false
  }
}

export function logout() {
  authStore.token = ''
  authStore.user = null
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export async function checkAuth() {
  if (!authStore.token) return false
  try {
    const data = await authAPI.me()
    authStore.user = data.user
    localStorage.setItem('user', JSON.stringify(data.user))
    return true
  } catch (e) {
    logout()
    return false
  }
}

export const roleMap = {
  admin: '管理员',
  leader: '领导',
  supervisor_tech: '技术主管',
  supervisor_quality: '质量主管',
  staff_tech: '技术员',
  staff_quality: '质量员',
  user: '普通用户'
}

export const taskTypeMap = {
  self_repair: { label: '自主修', color: '#1677ff', bg: '#e6f4ff' },
  rectification: { label: '问题整改', color: '#fa8c16', bg: '#fff7e6' },
  quality_analysis: { label: '现场质量问题分析', color: '#722ed1', bg: '#f9f0ff' },
  key_work: { label: '部门重点工作', color: '#13c2c2', bg: '#e6fffb' },
  daily_management: { label: '部门日常管理', color: '#faad14', bg: '#fffbe6' }
}

export const statusMap = {
  pending: { label: '待开始', color: '#8c8c8c', bg: '#f5f5f5' },
  decomposing: { label: '分解中', color: '#722ed1', bg: '#f9f0ff' },
  in_progress: { label: '进行中', color: '#1677ff', bg: '#e6f4ff' },
  feedback: { label: '反馈中', color: '#13c2c2', bg: '#e6fffb' },
  review: { label: '待验收', color: '#fa8c16', bg: '#fff7e6' },
  completed: { label: '已完成', color: '#52c41a', bg: '#f6ffed' },
  overdue: { label: '已逾期', color: '#ff4d4f', bg: '#fff2f0' },
  cancelled: { label: '已撤回', color: '#8c8c8c', bg: '#f5f5f5' }
}
