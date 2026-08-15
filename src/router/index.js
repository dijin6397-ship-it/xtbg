import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/LandingPage.vue'),
    meta: { title: '协同办公平台' }
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../views/admin/A_Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/select-module',
    name: 'ModuleSelect',
    component: () => import('../views/ModuleSelect.vue'),
    meta: { title: '选择模块', requiresAuth: true }
  },
  {
    path: '/module/:key',
    name: 'ComingSoon',
    component: () => import('../views/ComingSoon.vue'),
    meta: { title: '模块', requiresAuth: true }
  },
  {
    path: '/m',
    component: () => import('../views/mobile/MobileLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'M_Home', component: () => import('../views/mobile/M_ModuleSelect.vue'), meta: { title: '模块选择' } },
      { path: 'dashboard', name: 'M_Dashboard', component: () => import('../views/mobile/M_Dashboard.vue'), meta: { title: '工作台' } },
      { path: 'tasks', name: 'M_TaskList', component: () => import('../views/mobile/M_TaskList.vue'), meta: { title: '任务列表' } },
      { path: 'publish', name: 'M_TaskPublish', component: () => import('../views/mobile/M_TaskPublish.vue'), meta: { title: '发布任务' } },
      { path: 'task/:id', name: 'M_TaskDetail', component: () => import('../views/mobile/M_TaskDetail.vue'), meta: { title: '任务详情' } },
      { path: 'task/:id/decompose', name: 'M_TaskDecompose', component: () => import('../views/mobile/M_TaskDecompose.vue'), meta: { title: '任务分解' } },
      { path: 'task/:id/feedback', name: 'M_TaskFeedback', component: () => import('../views/mobile/M_TaskFeedback.vue'), meta: { title: '提交反馈' } },
      { path: 'task/:id/complete', name: 'M_TaskComplete', component: () => import('../views/mobile/M_TaskComplete.vue'), meta: { title: '申请完成' } },
      { path: 'supervision', name: 'M_Supervision', component: () => import('../views/mobile/M_Supervision.vue'), meta: { title: '督办中心' } },
      { path: 'account', name: 'M_AccountManage', component: () => import('../views/mobile/M_AccountManage.vue'), meta: { title: '账号管理', roles: ['admin'] } }
    ]
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('../views/admin/A_Dashboard.vue'), meta: { title: '工作台' } },
      { path: 'tasks', name: 'AdminTaskList', component: () => import('../views/admin/A_TaskList.vue'), meta: { title: '任务管理' } },
      { path: 'task-new', name: 'AdminTaskPublish', component: () => import('../views/admin/A_TaskPublish.vue'), meta: { title: '新建任务' } },
      { path: 'task/:id', name: 'AdminTaskDetail', component: () => import('../views/admin/A_TaskDetail.vue'), meta: { title: '任务详情' } },
      { path: 'task/:id/decompose', name: 'AdminTaskDecompose', component: () => import('../views/admin/A_TaskDecompose.vue'), meta: { title: '任务分解' } },
      { path: 'task/:id/feedback', name: 'AdminTaskFeedback', component: () => import('../views/admin/A_TaskFeedback.vue'), meta: { title: '提交反馈' } },
      { path: 'task/:id/complete', name: 'AdminTaskComplete', component: () => import('../views/admin/A_TaskComplete.vue'), meta: { title: '申请完成' } },
      { path: 'supervision', name: 'AdminSupervision', component: () => import('../views/admin/A_Supervision.vue'), meta: { title: '督办中心' } },
      { path: 'showcase', name: 'AdminShowcase', component: () => import('../views/admin/A_Showcase.vue'), meta: { title: '任务展示' } },
      { path: 'users', name: 'AdminUsers', component: () => import('../views/admin/A_UserManagement.vue'), meta: { title: '账号管理', roles: ['admin'] } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 协同管理平台`
  }

  if (to.meta.public) {
    return next()
  }

  if (to.path === '/') {
    return next()
  }

  const token = localStorage.getItem('token')
  if (!token) {
    return next('/admin/login')
  }

  if (to.meta.roles) {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user || !to.meta.roles.includes(user.role)) {
      return next('/select-module')
    }
  }

  next()
})

export default router
