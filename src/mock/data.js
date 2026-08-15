export const priorityMap = {
  urgent: { label: '紧急', color: '#ff4d4f', bg: '#fff2f0' },
  high: { label: '重要', color: '#fa8c16', bg: '#fff7e6' },
  normal: { label: '普通', color: '#1677ff', bg: '#e6f4ff' },
  low: { label: '低优', color: '#8c8c8c', bg: '#f5f5f5' }
}

export const statusMap = {
  pending: { label: '待开始', color: '#8c8c8c', bg: '#f5f5f5' },
  in_progress: { label: '进行中', color: '#1677ff', bg: '#e6f4ff' },
  review: { label: '待验收', color: '#fa8c16', bg: '#fff7e6' },
  completed: { label: '已完成', color: '#52c41a', bg: '#f6ffed' },
  overdue: { label: '已逾期', color: '#ff4d4f', bg: '#fff2f0' }
}

export const departments = ['技术研发部', '产品设计部', '市场营销部', '人力资源部', '财务部', '运营管理部']

export const users = [
  { id: 1, name: '张明', dept: '技术研发部' },
  { id: 2, name: '李雪', dept: '产品设计部' },
  { id: 3, name: '王强', dept: '市场营销部' },
  { id: 4, name: '赵丽', dept: '人力资源部' },
  { id: 5, name: '陈伟', dept: '技术研发部' },
  { id: 6, name: '刘洋', dept: '运营管理部' },
  { id: 7, name: '周婷', dept: '财务部' },
  { id: 8, name: '吴刚', dept: '技术研发部' }
]

export const tasks = [
  {
    id: 1, title: 'Q2产品迭代方案评审',
    description: '完成Q2产品迭代方案的内部评审，包括新功能优先级排序、技术可行性分析、资源需求评估。',
    publisher: users[0], assignees: [users[1], users[2]], department: '产品设计部',
    priority: 'urgent', status: 'in_progress', progress: 60,
    deadline: '2026-05-18', createdAt: '2026-05-08', tags: ['产品', '评审', 'Q2'],
    supervisor: users[0], urgCount: 2,
    milestones: [
      { title: '方案初稿完成', done: true, date: '2026-05-10' },
      { title: '内部讨论', done: true, date: '2026-05-12' },
      { title: '评审会议', done: false, date: '2026-05-16' },
      { title: '方案定稿', done: false, date: '2026-05-18' }
    ],
    comments: [
      { user: users[1], content: '初稿已完成，正在收集各方意见', time: '2026-05-10 14:30' },
      { user: users[0], content: '请加快进度，客户催得紧', time: '2026-05-12 09:00' }
    ]
  },
  {
    id: 2, title: '新员工入职培训安排',
    description: '组织5月份新入职员工的培训工作。',
    publisher: users[3], assignees: [users[3]], department: '人力资源部',
    priority: 'high', status: 'pending', progress: 0,
    deadline: '2026-05-20', createdAt: '2026-05-11', tags: ['HR', '培训'],
    supervisor: users[5], urgCount: 0,
    milestones: [
      { title: '培训计划制定', done: false, date: '2026-05-14' },
      { title: '讲师确认', done: false, date: '2026-05-16' },
      { title: '培训实施', done: false, date: '2026-05-20' }
    ],
    comments: []
  },
  {
    id: 3, title: '官网改版上线',
    description: '完成公司官网全面改版，包括首页重设计、产品页面优化、移动端适配。',
    publisher: users[0], assignees: [users[4], users[7]], department: '技术研发部',
    priority: 'high', status: 'in_progress', progress: 75,
    deadline: '2026-05-25', createdAt: '2026-05-05', tags: ['官网', '改版'],
    supervisor: users[0], urgCount: 1,
    milestones: [
      { title: '设计稿确认', done: true, date: '2026-05-08' },
      { title: '前端开发', done: true, date: '2026-05-15' },
      { title: '后端接口对接', done: false, date: '2026-05-20' },
      { title: '测试上线', done: false, date: '2026-05-25' }
    ],
    comments: [
      { user: users[4], content: '前端主体开发完成', time: '2026-05-14 16:20' }
    ]
  },
  {
    id: 4, title: 'Q1财务报表审核',
    description: '完成Q1季度财务报表终审。',
    publisher: users[6], assignees: [users[6]], department: '财务部',
    priority: 'normal', status: 'review', progress: 90,
    deadline: '2026-05-15', createdAt: '2026-05-03', tags: ['财务', 'Q1'],
    supervisor: users[5], urgCount: 0,
    milestones: [
      { title: '数据汇总', done: true, date: '2026-05-06' },
      { title: '初审完成', done: true, date: '2026-05-10' },
      { title: '终审确认', done: false, date: '2026-05-15' }
    ],
    comments: [
      { user: users[6], content: '初审已完成，发现几处数据需要核实', time: '2026-05-10 17:30' }
    ]
  },
  {
    id: 5, title: '618营销活动策划',
    description: '制定618年中大促整体营销方案。',
    publisher: users[2], assignees: [users[2]], department: '市场营销部',
    priority: 'urgent', status: 'in_progress', progress: 35,
    deadline: '2026-05-16', createdAt: '2026-05-06', tags: ['营销', '618'],
    supervisor: users[5], urgCount: 3,
    milestones: [
      { title: '市场调研', done: true, date: '2026-05-08' },
      { title: '方案策划', done: false, date: '2026-05-12' },
      { title: '预算审批', done: false, date: '2026-05-14' },
      { title: '方案定稿', done: false, date: '2026-05-16' }
    ],
    comments: [
      { user: users[5], content: '方案策划已逾期，请尽快完成', time: '2026-05-13 09:00' }
    ]
  },
  {
    id: 6, title: '系统安全漏洞修复',
    description: '修复安全审计中发现的高危和中危漏洞。',
    publisher: users[0], assignees: [users[4], users[7]], department: '技术研发部',
    priority: 'urgent', status: 'overdue', progress: 40,
    deadline: '2026-05-10', createdAt: '2026-05-02', tags: ['安全', '漏洞'],
    supervisor: users[0], urgCount: 4,
    milestones: [
      { title: '漏洞分析', done: true, date: '2026-05-04' },
      { title: '高危修复', done: false, date: '2026-05-08' },
      { title: '中危修复', done: false, date: '2026-05-10' }
    ],
    comments: [
      { user: users[0], content: '高危漏洞修复已逾期，请立即处理！', time: '2026-05-09 08:30' },
      { user: users[4], content: '正在修复中，预计明天完成', time: '2026-05-09 10:15' },
      { user: users[0], content: '已第二次催办，请务必优先处理', time: '2026-05-10 09:00' }
    ]
  },
  {
    id: 7, title: '供应链管理系统优化',
    description: '对供应链管理系统进行性能优化和功能升级。',
    publisher: users[5], assignees: [users[4], users[1]], department: '运营管理部',
    priority: 'normal', status: 'in_progress', progress: 50,
    deadline: '2026-05-30', createdAt: '2026-05-07', tags: ['供应链'],
    supervisor: users[5], urgCount: 0,
    milestones: [
      { title: '需求分析', done: true, date: '2026-05-10' },
      { title: '方案设计', done: true, date: '2026-05-15' },
      { title: '开发实施', done: false, date: '2026-05-25' },
      { title: '测试验收', done: false, date: '2026-05-30' }
    ],
    comments: []
  },
  {
    id: 8, title: '月度部门绩效汇总',
    description: '汇总各部门4月份绩效数据。',
    publisher: users[3], assignees: [users[3]], department: '人力资源部',
    priority: 'normal', status: 'completed', progress: 100,
    deadline: '2026-05-12', createdAt: '2026-05-01', tags: ['绩效'],
    supervisor: users[5], urgCount: 0,
    milestones: [
      { title: '数据收集', done: true, date: '2026-05-05' },
      { title: '报告编制', done: true, date: '2026-05-10' },
      { title: '评审完成', done: true, date: '2026-05-12' }
    ],
    comments: [
      { user: users[5], content: '绩效报告已审核通过', time: '2026-05-12 15:00' }
    ]
  }
]

export const supervisionLogs = [
  { id: 1, taskId: 6, type: 'urge', operator: users[0], target: users[4], content: '高危漏洞修复已逾期，请立即处理！', time: '2026-05-09 08:30' },
  { id: 2, taskId: 6, type: 'warn', operator: users[0], target: users[7], content: '安全漏洞修复任务严重逾期', time: '2026-05-10 09:00' },
  { id: 3, taskId: 1, type: 'urge', operator: users[0], target: users[1], content: '评审会议临近，请加快进度', time: '2026-05-12 09:00' },
  { id: 4, taskId: 5, type: 'escalate', operator: users[5], target: users[2], content: '618方案策划已逾期，已升级至部门总监督办', time: '2026-05-13 09:00' },
  { id: 5, taskId: 3, type: 'urge', operator: users[0], target: users[4], content: '官网改版后端接口对接需要加速', time: '2026-05-13 10:00' }
]
