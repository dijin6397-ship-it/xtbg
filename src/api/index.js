const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  }
  const res = await fetch(`${BASE}${url}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/admin/login'
    throw new Error('未登录')
  }
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data
}

export const authAPI = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  changePassword: (oldPassword, newPassword) => request('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) })
}

export const userAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/users${qs ? '?' + qs : ''}`)
  },
  // 带「模块权限分配情况」的用户列表（账号管理页使用，需要后台管理模块权限）
  full: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/users/full${qs ? '?' + qs : ''}`)
  },
  get: (id) => request(`/users/${id}`),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  hardDelete: (id) => request(`/users/${id}/hard`, { method: 'DELETE' }),
  // 可配置的细粒度权限清单
  permissions: () => request('/users/permissions')
}

// WBS 数据字典（项目WBS - 车号），维护入口在账号选择页面的「WBS字典维护」
export const wbsAPI = {
  list: () => request('/wbs'),
  tree: () => request('/wbs/tree'),
  create: (data) => request('/wbs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/wbs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/wbs/${id}`, { method: 'DELETE' }),
  // 批量扩充：下载 Excel 模板 / 导入 Excel（需后台管理模块权限）
  async downloadTemplate() {
    const token = getToken()
    const res = await fetch(`${BASE}/wbs/import-template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) {
      let msg = '模板下载失败'
      try { msg = (await res.json()).error || msg } catch (e) { /* ignore */ }
      throw new Error(msg)
    }
    return res.blob()
  },
  import: (fileBase64) => request('/wbs/import', {
    method: 'POST',
    body: JSON.stringify({ fileBase64 })
  })
}

// 任务导入（独立权限 task_import）
export const taskImportAPI = {
  templateUrl: () => `${BASE}/task-import/template`,
  // 需要带 token，所以用 fetch 下载 blob
  async downloadTemplate() {
    const token = getToken()
    const res = await fetch(`${BASE}/task-import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) {
      let msg = '模板下载失败'
      try { msg = (await res.json()).error || msg } catch (e) { /* ignore */ }
      throw new Error(msg)
    }
    return res.blob()
  },
  import: (fileBase64, dryRun = false) => request('/task-import/import', {
    method: 'POST',
    body: JSON.stringify({ fileBase64, dryRun })
  })
}

export const taskAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/tasks${qs ? '?' + qs : ''}`)
  },
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assign: (id, data) => request(`/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  addSubtasks: (id, subtasks) => request(`/tasks/${id}/subtasks`, { method: 'POST', body: JSON.stringify({ subtasks }) }),
  updateSubtask: (id, subId, data) => request(`/tasks/${id}/subtasks/${subId}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeSubtask: (id, subId) => request(`/tasks/${id}/subtasks/${subId}`, { method: 'DELETE' }),
  editPermission: (id) => request(`/tasks/${id}/edit-permission`),
  addFeedback: (id, data) => request(`/tasks/${id}/feedback`, { method: 'POST', body: JSON.stringify(data) }),
  submitOutput: (id, data) => request(`/tasks/${id}/submit-output`, { method: 'POST', body: JSON.stringify(data) }),
  reviewOutput: (id, data) => request(`/tasks/${id}/review-output`, { method: 'POST', body: JSON.stringify(data) }),
  approveFinal: (id, data) => request(`/tasks/${id}/approve-final`, { method: 'POST', body: JSON.stringify(data) }),
  submitComplete: (id, data) => request(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  urge: (id, data) => request(`/tasks/${id}/urge`, { method: 'POST', body: JSON.stringify(data) }),
  recall: (id) => request(`/tasks/${id}/recall`, { method: 'PUT' }),
  recallOutput: (id, outputId) => request(`/tasks/${id}/outputs/${outputId}/recall`, { method: 'PUT' }),
  recallComplete: (id) => request(`/tasks/${id}/recall-complete`, { method: 'PUT' }),
  remove: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  stats: () => request('/tasks/stats/overview')
}

export const notificationAPI = {
  list: () => request('/notifications'),
  markRead: (ids) => request('/notifications/read', { method: 'PUT', body: JSON.stringify({ ids }) }),
  remove: (id) => request(`/notifications/${id}`, { method: 'DELETE' })
}

export const supervisionAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/supervision${qs ? '?' + qs : ''}`)
  },
  stats: () => request('/supervision/stats')
}

export const departmentAPI = {
  list: () => request('/departments')
}

export const moduleAPI = {
  list: () => request('/modules'),
  myModules: () => request('/modules/my'),
  setUserModules: (userId, moduleIds) => request(`/modules/${userId}`, { method: 'PUT', body: JSON.stringify({ moduleIds }) })
}

export const dictionaryAPI = {
  list: () => request('/dictionary'),
  tree: () => request('/dictionary/tree'),
  byLevel: (level, parentId) => {
    const qs = parentId ? `?parentId=${parentId}` : ''
    return request(`/dictionary/level/${level}${qs}`)
  },
  create: (data) => request('/dictionary', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/dictionary/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/dictionary/${id}`, { method: 'DELETE' }),
  report: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/dictionary/report${qs ? '?' + qs : ''}`)
  }
}
