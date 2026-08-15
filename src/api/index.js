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
  get: (id) => request(`/users/${id}`),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  hardDelete: (id) => request(`/users/${id}/hard`, { method: 'DELETE' })
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
  addFeedback: (id, data) => request(`/tasks/${id}/feedback`, { method: 'POST', body: JSON.stringify(data) }),
  submitOutput: (id, data) => request(`/tasks/${id}/submit-output`, { method: 'POST', body: JSON.stringify(data) }),
  reviewOutput: (id, data) => request(`/tasks/${id}/review-output`, { method: 'POST', body: JSON.stringify(data) }),
  approveFinal: (id, data) => request(`/tasks/${id}/approve-final`, { method: 'POST', body: JSON.stringify(data) }),
  submitComplete: (id, data) => request(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  urge: (id, data) => request(`/tasks/${id}/urge`, { method: 'POST', body: JSON.stringify(data) }),
  recall: (id) => request(`/tasks/${id}/recall`, { method: 'PUT' }),
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
